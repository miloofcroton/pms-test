import jsonPlugin from '@eslint/json';
import markdownPlugin from '@eslint/markdown';
import stylisticPlugin from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import { configs as packageJsonConfigs } from 'eslint-plugin-package-json';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tsPlugin from 'typescript-eslint';
import type { AST, Rule } from 'eslint';

// Local layout rules, registered below as the `local` plugin.

/**
 * Arrays are multi-line by choice: put one line break anywhere inside the brackets (after `[`, between elements, or before `]`) and every gap gets one, so each element sits on its own line and neither bracket shares a line with an element.
 * An array with no break stays as written.
 * Only breaks in those gaps count, so a multi-line element does not force its siblings apart.
 */
const arrayNewline: Rule.RuleModule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: { missing: 'Expected a line break here, because this array is multi-line.' },
  },
  create(context) {
    const { sourceCode } = context;

    return {
      ArrayExpression(node) {
        const elements = node.elements;
        if (elements.length === 0 || elements.some((element) => element === null)) {
          return;
        }

        const open = sourceCode.getFirstToken(node);
        const close = sourceCode.getLastToken(node);
        if (!open || !close) {
          return;
        }

        // [start, end] of each stretch of whitespace between the brackets and elements.
        const gaps: Array<[number, number]> = [];
        let from = open.range[1];
        for (const element of elements) {
          const range = element!.range!;
          gaps.push([from, range[0]]);
          // Skip past the comma that follows the element, if there is one.
          const after = sourceCode.getTokenAfter(element!);
          from = after?.value === ',' ? after.range[1] : range[1];
        }
        gaps.push([from, close.range[0]]);

        const text = sourceCode.getText();
        const hasBreak = gaps.some(([start, end]) => text.slice(start, end)
          .includes('\n'));
        if (!hasBreak) {
          return;
        }

        for (const [start, end] of gaps) {
          const gap = text.slice(start, end);
          if (gap.includes('\n') || gap.trim() !== '') {
            continue;
          }
          context.report({
            node,
            loc: {
              start: sourceCode.getLocFromIndex(start),
              end: sourceCode.getLocFromIndex(end),
            },
            messageId: 'missing',
            fix: (fixer) => fixer.replaceTextRange([start, end], '\n'),
          });
        }
      },
    };
  },
};

/** The few ESTree node properties the chain rule reads, whatever the node type. */
type ChainNode = {
  type: string;
  parent: ChainNode;
  object?: ChainNode;
  callee?: ChainNode;
  expression?: ChainNode;
  property?: ChainNode;
  computed?: boolean;
};

const asNode = (node: ChainNode) => node as unknown as Rule.Node;

/**
 * A chain with more than one `.method()` call is multi-line: `boolean().notNull().default(false)` puts `.notNull()` and `.default(false)` on their own lines.
 * A shorter chain stays as written until a line break is put before any `.`, which then breaks every `.` in that chain.
 * When the chain starts at a plain name, as in `db.select()`, that first `.` stays with its head unless it has a break itself.
 */
const chainNewline: Rule.RuleModule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: { missing: 'Expected a line break before this ".", because this chain is multi-line.' },
  },
  create(context) {
    const { sourceCode } = context;
    const isDot = (token: AST.Token) => token.value === '.' || token.value === '?.';

    const check = (outer: ChainNode) => {
      const { parent } = outer;
      const continuesChain = (parent.type === 'MemberExpression' && parent.object === outer)
        || (parent.type === 'CallExpression' && parent.callee === outer)
        || parent.type === 'ChainExpression'
        || parent.type === 'TSNonNullExpression';
      if (continuesChain) {
        return;
      }

      const dots: Array<{
        token: AST.Token;
        object: ChainNode
      }> = [];
      let hasCall = false;
      let methodCalls = 0;
      let node: ChainNode | undefined = outer;
      while (node) {
        if (node.type === 'CallExpression') {
          hasCall = true;
          if (node.callee?.type === 'MemberExpression' && !node.callee.computed) {
            methodCalls++;
          }
          node = node.callee;
        }
        else if (node.type === 'MemberExpression') {
          const token = node.computed ? null : sourceCode.getTokenBefore(asNode(node.property!), { filter: isDot });
          if (token) {
            dots.push({
              token,
              object: node.object!,
            });
          }
          node = node.object;
        }
        else if (node.type === 'ChainExpression' || node.type === 'TSNonNullExpression') {
          node = node.expression;
        }
        else {
          break;
        }
      }
      if (!hasCall || dots.length === 0) {
        return;
      }
      dots.sort((a, b) => a.token.range[0] - b.token.range[0]);

      const breaksBefore = (token: AST.Token) => {
        const previous = sourceCode.getTokenBefore(token)!;
        return token.loc.start.line > previous.loc.end.line;
      };
      if (methodCalls < 2 && !dots.some(({ token }) => breaksBefore(token))) {
        return;
      }

      const [first] = dots;
      const startsAtName = ['Identifier', 'ThisExpression', 'Super'].includes(first.object.type);
      for (const { token } of dots) {
        if ((startsAtName && token === first.token && !breaksBefore(token)) || breaksBefore(token)) {
          continue;
        }
        const previous = sourceCode.getTokenBefore(token)!;
        if (sourceCode.commentsExistBetween(previous, token)) {
          continue;
        }
        context.report({
          loc: token.loc,
          messageId: 'missing',
          fix: (fixer) => fixer.replaceTextRange([previous.range[1], token.range[0]], '\n'),
        });
      }
    };

    return {
      CallExpression: (node) => check(node as unknown as ChainNode),
      MemberExpression: (node) => check(node as unknown as ChainNode),
      ChainExpression: (node) => check(node as unknown as ChainNode),
    };
  },
};

const localPlugin = {
  rules: {
    'array-newline': arrayNewline,
    'chain-newline': chainNewline,
  },
};

const allSrcFiles = ['**/*.ts', '**/*.tsx'];
const allReactFiles = ['**/*.tsx'];

const globalIgnoresConfig = {
  ignores: [
    '**/node_modules',
    '**/.build',
    '**/.output',
    '**/.nitro',
    '**/.react-router',
    // generated by drizzle-kit
    '**/drizzle',
  ],
};

const codeStyleConfig = {
  files: allSrcFiles,
  plugins: {
    '@stylistic': stylisticPlugin,
    'local': localPlugin,
  },
  rules: {
    'local/array-newline': 'error',
    'local/chain-newline': 'error',
    '@stylistic/indent': ['error', 2],
    '@stylistic/semi': ['error', 'always'],
    '@stylistic/no-trailing-spaces': 'error',
    '@stylistic/quotes': ['error', 'single'],
    '@stylistic/quote-props': ['error', 'consistent'],
    '@stylistic/comma-dangle': ['error', 'always-multiline'],
    '@stylistic/comma-spacing': ['error', {
      before: false,
      after: true,
    }],

    '@stylistic/brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
    '@stylistic/multiline-ternary': ['error', 'always-multiline'],
    '@stylistic/no-multi-spaces': ['error', {
      ignoreEOLComments: true,
      exceptions: {
        ObjectExpression: true,
        TSTypeAnnotation: true,
      },
    }],

    '@stylistic/object-curly-spacing': ['error', 'always'],
    '@stylistic/array-bracket-spacing': ['error', 'never'],

    // Anything with more than one member is fully multi-line: the braces break (`object-curly-newline`) and each member gets its own line (`object-property-newline`).
    // One-member objects stay inline.
    // The two rules are a pair: the first alone permits `{\n a: 1, b: 2\n}`.
    '@stylistic/object-curly-newline': ['error', {
      ObjectExpression: {
        multiline: true,
        minProperties: 2,
        consistent: true,
      },
      TSTypeLiteral: {
        multiline: true,
        minProperties: 2,
        consistent: true,
      },
      TSInterfaceBody: {
        multiline: true,
        minProperties: 2,
        consistent: true,
      },
      ObjectPattern: { consistent: true },
      ImportDeclaration: { consistent: true },
      ExportDeclaration: { consistent: true },
    }],
    '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
  },
};

const typescriptConfig = {
  files: allSrcFiles,
  plugins: { '@typescript-eslint': tsPlugin.plugin },
  languageOptions: {
    parser: tsPlugin.parser,
    sourceType: 'module' as const,
    globals: {
      ...globals.node,
      ...globals.browser,
    },
  },
  rules: {
    '@typescript-eslint/ban-ts-comment': 'error',
    '@typescript-eslint/no-array-constructor': 'error',
    '@typescript-eslint/no-duplicate-enum-values': 'error',
    '@typescript-eslint/no-extra-non-null-assertion': 'error',
    '@typescript-eslint/no-loss-of-precision': 'error',
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/no-namespace': 'error',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    '@typescript-eslint/no-this-alias': 'error',
    '@typescript-eslint/no-unnecessary-type-constraint': 'error',
    '@typescript-eslint/no-unsafe-declaration-merging': 'error',
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/triple-slash-reference': 'error',

    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', {
      args: 'none',
      ignoreRestSiblings: true,
      destructuredArrayIgnorePattern: '^_',
    }],

    '@typescript-eslint/adjacent-overload-signatures': 'error',
    '@typescript-eslint/ban-tslint-comment': 'error',
    '@typescript-eslint/class-literal-property-style': 'error',
    '@typescript-eslint/consistent-generic-constructors': 'error',
    '@typescript-eslint/consistent-indexed-object-style': 'error',
    '@typescript-eslint/consistent-type-assertions': 'error',
    '@typescript-eslint/no-confusing-non-null-assertion': 'error',
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/array-type': ['error', { default: 'generic' }],

    // The shared package is types only, so neither build has to resolve it.
    '@typescript-eslint/no-restricted-imports': ['error', {
      paths: [
        {
          name: '@sync-app/shared',
          message: 'Import @sync-app/shared with `import type`: it is types only, and neither build resolves it.',
          allowTypeImports: true,
        },
      ],
    }],
  },
};

const reactConfig = {
  files: allReactFiles,
  plugins: {
    'react': reactPlugin,
    'react-hooks': reactHooksPlugin,
  },
  settings: { react: { version: 'detect' } },
  rules: {
    ...reactPlugin.configs.flat.recommended.rules,
    'react/display-name': 'warn',
    'react/no-danger': 'error',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',

    ...reactHooksPlugin.configs.recommended.rules,
    'react-hooks/exhaustive-deps': 'off',
  },
};

/**
 * `simple-import-sort` matches its group patterns against the module source with a NUL appended when the statement is `import type`.
 * `valueOnly` and `typeOnly` pin a pattern to one kind, so pairing every pattern with a type-only twin sorts type imports directly after the value imports of the same group, with no blank line between them.
 */
const END = '\\u0000?$';
const valueOnly = '(?![^\\u0000]+\\u0000$)';
const typeOnly = '(?=[^\\u0000]+\\u0000$)';

const withTypesLast = (patterns: Array<string>) => [
  ...patterns.map((pattern) => `^${valueOnly}${pattern}`),
  ...patterns.map((pattern) => `^${typeOnly}${pattern}`),
];

const sortImportsConfig = {
  files: allSrcFiles,
  plugins: {
    'simple-import-sort': simpleImportSortPlugin,
    'import': importPlugin,
  },
  rules: {
    'import/first': 'error',
    'import/newline-after-import': 'error',

    // Lift inline `type` specifiers into their own `import type` statement, so the groups below have something to sort.
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],

    'simple-import-sort/exports': 'off',
    'simple-import-sort/imports': ['error', {
      groups: [
        // Side effect imports.
        ['^\\u0000'],

        // Node.js builtins prefixed with `node:`.
        withTypesLast(['node:']),

        // External packages. `react` related packages come first.
        withTypesLast(['react', '@?\\w']),

        // Absolute imports from this package's `src/` (`~/`).
        withTypesLast(['~/']),

        // Parent imports. Put `..` last.
        withTypesLast([`\\.\\.(?!/?${END})`, `\\.\\./?${END}`]),

        // Other relative imports. Put same-folder imports and `.` last.
        withTypesLast([
          `\\./(?=.*/)(?!/?${END})`,
          `\\.(?!/?${END})`,
          `\\./?${END}`,
        ]),

        // Style imports.
        withTypesLast([`.+\\.s?css${END}`]),
      ],
    }],
  },
};

const packageJsonFiles = ['**/package.json', '**/package-lock.json'];
const jsoncFiles = ['**/tsconfig.json', '**/tsconfig.*.json'];

const jsonConfig = {
  files: ['**/*.json'],
  ignores: [...packageJsonFiles, ...jsoncFiles],
  language: 'json/json',
  plugins: { json: jsonPlugin },
  rules: { ...jsonPlugin.configs.recommended.rules },
};

const jsoncConfig = {
  files: jsoncFiles,
  language: 'json/jsonc',
  languageOptions: {
    allowTrailingCommas: true,
    allowComments: true,
  },
  plugins: { json: jsonPlugin },
  rules: { ...jsonPlugin.configs.recommended.rules },
};

const packageJsonConfig = {
  ...packageJsonConfigs.recommended,
  rules: {
    ...packageJsonConfigs.recommended.rules,
    ...packageJsonConfigs.stylistic.rules,
    // Too strict for private packages
    'package-json/require-attribution': 'off',
    'package-json/require-description': 'off',
    'package-json/require-exports': 'off',
    'package-json/require-files': 'off',
    'package-json/require-license': 'off',
    'package-json/require-repository': 'off',
    'package-json/require-sideEffects': 'off',
    'package-json/require-type': 'off',

    'package-json/order-properties': ['error', {
      order: [
        'name',
        'description',
        'version',
        'private',
        'type',
        'engines',
        'peerDependencies',
        'devDependencies',
        'dependencies',
        'scripts',
      ],
    }],
  },
};

const markdownConfig = {
  files: ['**/*.md'],
  plugins: { markdown: markdownPlugin },
  language: 'markdown/commonmark',
  rules: {
    'markdown/heading-increment': 'warn',
    'markdown/no-empty-links': 'warn',
    'markdown/no-invalid-label-refs': 'warn',
  },
};

export default [
  globalIgnoresConfig,
  codeStyleConfig,
  typescriptConfig,
  reactConfig,
  sortImportsConfig,
  jsonConfig,
  jsoncConfig,
  packageJsonConfig,
  markdownConfig,
];

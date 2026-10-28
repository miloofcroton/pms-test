import type { AST, Rule } from 'eslint';

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

export default {
  rules: {
    'array-newline': arrayNewline,
    'chain-newline': chainNewline,
  },
};

import { reactRouter } from '@react-router/dev/vite';
import wyw from '@wyw-in-js/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    wyw({
      include: ['src/**/*.{ts,tsx}'],
      displayName: false,
      babelOptions: {
        presets: ['@babel/preset-react', '@babel/preset-typescript'],
      },
    }),
    // disables react router route creation while running tests
    !process.env.VITEST && reactRouter(),
  ],
  test: {
    environment: 'node',
  },
});

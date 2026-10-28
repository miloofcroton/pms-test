import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { css } from '@linaria/core';

export const globals = css`
  :global() {
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
  }
`;

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
};

export const HydrateFallback = () => {
  return <p>Loading…</p>;
};

const App = () => {
  return <Outlet />;
};

export default App;

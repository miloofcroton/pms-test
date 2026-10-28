import { isRouteErrorResponse, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from 'react-router';
import { css } from '@linaria/core';

import { getJson } from '~/utils/api';
import { nav, page } from '~/utils/styles';
import type { Property } from '~/utils/api';

import type { Route } from './+types/root';

export const globals = css`
  :global() {
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1a1a;
    }

    a {
      color: #0b5cad;
    }

    h1 {
      font-size: 1.5rem;
    }

    h2 {
      font-size: 1.15rem;
      margin-top: 2rem;
    }

    h3 {
      font-size: 1rem;
    }
  }
`;

const active = css`
  font-weight: 600;
  text-decoration: none;
`;

// The properties the sync has run, for the navigation. There is one in the data, so the links go to the first.
export const clientLoader = async () => {
  return getJson<{ properties: Array<Property> }>('/properties');
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sync app</title>
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

const Nav = () => {
  const data = useRouteLoaderData<typeof clientLoader>('root');
  const property = data?.properties[0];
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? active : '');
  return (
    <nav className={nav}>
      <strong>Sync app</strong>
      <NavLink to="/" end className={linkClass}>Runs</NavLink>
      {property && (
        <>
          <NavLink to={`/properties/${property.remoteId}/units`} className={linkClass}>Units</NavLink>
          <NavLink to={`/properties/${property.remoteId}/changes`} className={linkClass}>Change log</NavLink>
          <span>{property.name}</span>
        </>
      )}
    </nav>
  );
};

export const HydrateFallback = () => {
  return <p className={page}>Loading…</p>;
};

const App = () => {
  return (
    <>
      <Nav />
      <main className={page}>
        <Outlet />
      </main>
    </>
  );
};

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Response
      ? `${error.status} ${error.statusText}`
      : 'The API could not be reached. Is it running on :4444?';
  return (
    <main className={page}>
      <h1>Something went wrong</h1>
      <p>{message}</p>
      <p><a href="/">Back to runs</a></p>
    </main>
  );
};

export default App;

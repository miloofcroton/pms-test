import { useEffect, useState } from 'react';
import { css } from '@linaria/core';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4444';

const page = css`
  padding: 2rem;
`;

type Health = {
  status: string;
  db: string;
  timestamp: string
};

const Home = () => {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/healthcheck`)
      .then((res) => res.json())
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className={page}>
      <h1>Sync app</h1>
      {error && <p>API unreachable: {error}</p>}
      {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
    </main>
  );
};

export default Home;

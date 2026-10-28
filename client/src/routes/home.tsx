import { styled } from '@linaria/react';
import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4444';

const Page = styled.main`
  padding: 2rem;
`;

type Health = { status: string; db: string; timestamp: string };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/healthcheck`)
      .then((res) => res.json())
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <Page>
      <h1>RentLive PMS</h1>
      {error && <p>API unreachable: {error}</p>}
      {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
    </Page>
  );
}

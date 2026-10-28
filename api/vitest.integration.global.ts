import pg from 'pg';

// The integration tests' own database, next to the app's `sync_app` in the same postgres.
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://sync_app:sync_app_dev_password@localhost:5432/sync_app_test';

// Creates the test database once per test run, if it's missing, by connecting to the server's default database.
const setup = async (): Promise<void> => {
  const url = new URL(TEST_DATABASE_URL);
  const name = url.pathname.slice(1);
  url.pathname = '/postgres';
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [name]);
    if (rowCount === 0) {
      await client.query(`create database "${name}"`);
    }
  }
  finally {
    await client.end();
  }
};

export default setup;

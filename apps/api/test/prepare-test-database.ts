import { Client } from 'pg';

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!adminDatabaseUrl || !testDatabaseUrl) {
  throw new Error('ADMIN_DATABASE_URL and TEST_DATABASE_URL are required');
}

const testUrl = new URL(testDatabaseUrl);
const databaseName = testUrl.pathname.slice(1);
if (databaseName !== 'tia_test') {
  throw new Error('Refusing to prepare any database other than tia_test');
}

const client = new Client({ connectionString: adminDatabaseUrl });
await client.connect();
try {
  const existing = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName],
  );
  if (existing.rowCount === 0) await client.query('CREATE DATABASE "tia_test"');
} finally {
  await client.end();
}

import { Injectable } from '@nestjs/common';
import { Client } from 'pg';

export type ImportLock = { release(): Promise<void> };

@Injectable()
export class ImportLockService {
  async acquire(): Promise<ImportLock | null> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required');
    const client = new Client({ connectionString });
    await client.connect();
    try {
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1, $2) AS acquired',
        [742311, 1],
      );
      if (!result.rows[0]?.acquired) {
        await client.end();
        return null;
      }
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          try {
            await client.query(
              'SELECT pg_advisory_unlock($1, $2)',
              [742311, 1],
            );
          } finally {
            await client.end();
          }
        },
      };
    } catch (error) {
      await client.end();
      throw error;
    }
  }
}

import { api } from '@tia/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('API client session recovery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shares one refresh request between parallel 401 responses', async () => {
    let authenticated = false;
    const profile = {
      id: '20000000-0000-4000-8000-000000000002',
      email: 'client.a@example.test',
      role: 'CLIENT' as const,
      companyId: '10000000-0000-4000-8000-000000000001',
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/auth/refresh') {
        authenticated = true;
        return new Response(null, { status: 204 });
      }
      if (!authenticated) {
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
      }
      return Response.json(profile);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(Promise.all([api.me(), api.me()])).resolves.toEqual([
      profile,
      profile,
    ]);
    expect(
      fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh'),
    ).toHaveLength(1);
  });
});

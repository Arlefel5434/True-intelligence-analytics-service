import { jest } from '@jest/globals';
import {
  ProviderClientService,
  ProviderRequestError,
} from './provider-client.service.js';

const validPage = {
  items: [],
  pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
};

describe('ProviderClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('retries temporary responses and sends the configured API key', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json(validPage));
    global.fetch = fetchMock;
    const client = new ProviderClientService({
      providerBaseUrl: 'http://provider.test',
      providerApiKey: 'secret-key',
      timeoutMs: 3_000,
    });

    await expect(
      client.getPage('2027-01-01', '2027-01-01', 1),
    ).resolves.toEqual(validPage);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      'X-API-Key': 'secret-key',
    });
  });

  it('does not retry authentication failures', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    global.fetch = fetchMock;
    const client = new ProviderClientService({
      providerBaseUrl: 'http://provider.test',
      providerApiKey: 'secret-key',
      timeoutMs: 3_000,
    });

    await expect(client.getPage('2027-01-01', '2027-01-01', 1)).rejects.toEqual(
      expect.objectContaining<Partial<ProviderRequestError>>({
        retryable: false,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { Inject, Injectable } from '@nestjs/common';
import { IMPORT_CONFIG, PROVIDER_PAGE_SIZE } from './import.constants.js';
import type { ImportConfig } from './import.config.js';
import { providerPageSchema, type ProviderPage } from './provider.types.js';

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
const delays = [100, 300];

@Injectable()
export class ProviderClientService {
  constructor(@Inject(IMPORT_CONFIG) private readonly config: ImportConfig) {}

  async getPage(from: string, to: string, page: number): Promise<ProviderPage> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        return await this.requestPage(from, to, page);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof ProviderRequestError && error.retryable;
        if (!retryable || attempt === delays.length) throw error;
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }
    throw lastError;
  }

  private async requestPage(
    from: string,
    to: string,
    page: number,
  ): Promise<ProviderPage> {
    const url = new URL('/v1/statistics', this.config.providerBaseUrl);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(PROVIDER_PAGE_SIZE));
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'X-API-Key': this.config.providerApiKey },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      throw new ProviderRequestError('Provider is unavailable', true);
    }
    if (!response.ok) {
      throw new ProviderRequestError(
        `Provider returned HTTP ${response.status}`,
        retryableStatuses.has(response.status),
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderRequestError('Provider returned invalid JSON', false);
    }
    const parsed = providerPageSchema.safeParse(body);
    if (!parsed.success) {
      throw new ProviderRequestError(
        'Provider returned an invalid page',
        false,
      );
    }
    return parsed.data;
  }
}

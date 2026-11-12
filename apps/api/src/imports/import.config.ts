export type ImportConfig = Readonly<{
  providerBaseUrl: string;
  providerApiKey: string;
  timeoutMs: number;
}>;

export function readImportConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ImportConfig {
  const providerBaseUrl = environment.PROVIDER_BASE_URL;
  const providerApiKey = environment.PROVIDER_API_KEY;
  if (!providerBaseUrl) throw new Error('PROVIDER_BASE_URL is required');
  if (!providerApiKey?.trim()) throw new Error('PROVIDER_API_KEY is required');
  let url: URL;
  try {
    url = new URL(providerBaseUrl);
  } catch {
    throw new Error('PROVIDER_BASE_URL must be a valid URL');
  }
  return {
    providerBaseUrl: url.toString().replace(/\/$/, ''),
    providerApiKey,
    timeoutMs: 3_000,
  };
}

export function readPort(value: string | undefined, fallback: number): number {
  const port = value === undefined ? fallback : Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

export type ProviderConfig = Readonly<{
  apiKey: string;
  mockScenariosEnabled: boolean;
}>;

function readBoolean(value: string | undefined): boolean {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('MOCK_SCENARIOS_ENABLED must be true or false');
}

export function readProviderConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ProviderConfig {
  const apiKey = environment.PROVIDER_API_KEY;
  if (!apiKey?.trim()) throw new Error('PROVIDER_API_KEY is required');
  return {
    apiKey,
    mockScenariosEnabled: readBoolean(environment.MOCK_SCENARIOS_ENABLED),
  };
}

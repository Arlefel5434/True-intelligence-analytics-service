export function readPort(value: string | undefined, fallback: number): number {
  const port = value === undefined ? fallback : Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

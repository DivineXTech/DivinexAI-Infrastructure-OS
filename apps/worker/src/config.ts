function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface WorkerConfig {
  databaseUrl: string;
  pollIntervalMs: number;
  leaseMs: number;
  workerId: string;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000),
    leaseMs: Number(process.env.WORKER_LEASE_MS ?? 60000),
    workerId: process.env.WORKER_ID ?? `worker-${process.pid}`,
  };
}

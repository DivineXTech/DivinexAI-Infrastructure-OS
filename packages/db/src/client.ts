import { Pool, type PoolClient } from "pg";

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

/**
 * Runs `fn` inside a transaction with the session configured exactly as
 * PostgREST configures it for an authenticated Supabase request: the
 * `authenticated` role and a `sub` claim RLS policies read via auth.uid().
 * The transaction always rolls back session settings on exit because
 * `SET LOCAL` is transaction-scoped.
 */
export async function withUserContext<T>(
  pool: Pool,
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE authenticated");
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("SELECT set_config('request.jwt.claim.role', 'authenticated', true)");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` as the Supabase service role, which bypasses RLS entirely.
 * Reserved for trusted server code: ledger writes, order/membership
 * finalization, payout settlement, AI job/credit accounting, audit
 * logging -- the tables with no `authenticated` write policy at all.
 */
export async function withServiceRoleContext<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE service_role");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Runs `fn` as the anonymous (unauthenticated) role -- for public storefront reads. */
export async function withAnonContext<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE anon");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

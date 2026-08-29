import type { Pool } from "pg";
import { withServiceRoleContext } from "@divinexai/db";
import type { ConsentSource, CreditMeter } from "@divinexai/ai-gateway";
import { getAiCreditBalance, insertAiCreditLedgerEntry, listConsentRecords } from "./repo";

/** Reads consent records with the service role so the gateway's cloning gate cannot be bypassed by RLS scoping. */
export class DbConsentSource implements ConsentSource {
  constructor(private readonly pool: Pool) {}

  async getConsentRecords(organizationId: string) {
    return withServiceRoleContext(this.pool, (client) => listConsentRecords(client, organizationId));
  }
}

/** Backs AI credit metering with the ai_credit_ledger table (service-role writes only, per RLS policy). */
export class DbCreditMeter implements CreditMeter {
  constructor(private readonly pool: Pool) {}

  async getBalance(organizationId: string): Promise<number> {
    return withServiceRoleContext(this.pool, (client) => getAiCreditBalance(client, organizationId));
  }

  async reserve(organizationId: string, credits: number): Promise<void> {
    await withServiceRoleContext(this.pool, (client) =>
      insertAiCreditLedgerEntry(client, { organizationId, delta: -credits, reason: "CONSUMPTION" }),
    );
  }

  async refund(organizationId: string, credits: number): Promise<void> {
    await withServiceRoleContext(this.pool, (client) =>
      insertAiCreditLedgerEntry(client, { organizationId, delta: credits, reason: "REFUND" }),
    );
  }
}

export async function grantAiCredits(pool: Pool, organizationId: string, credits: number): Promise<void> {
  await withServiceRoleContext(pool, (client) =>
    insertAiCreditLedgerEntry(client, { organizationId, delta: credits, reason: "GRANT" }),
  );
}

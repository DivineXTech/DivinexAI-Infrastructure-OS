import "server-only";
import { Pool } from "pg";
import { MockAgentFlowClient } from "@divinexai/agentflow-adapter";
import { MockFlowraPayClient } from "@divinexai/flowrapay-adapter";
import { AiProviderGateway, MockAiProvider } from "@divinexai/ai-gateway";
import { StaticFeeScheduleSource } from "@divinexai/fees";
import { DomainEventEmitter } from "@divinexai/events";
import { DbConsentSource, DbCreditMeter } from "@divinexai/dmtv-core";

/**
 * Process-wide singletons for the DMTV vertical slice. The FlowraPay and
 * AgentFlow Pro clients are mocks here (see their respective packages) --
 * swapping in the real integrations means constructing a real client that
 * satisfies the same FlowraPayClient / AgentFlowClient interface and
 * changing nothing else in this app.
 */
declare global {
  var __dmtvContext: DmtvContext | undefined;
}

export interface DmtvContext {
  pool: Pool;
  agentFlowClient: MockAgentFlowClient;
  flowraPayClient: MockFlowraPayClient;
  events: DomainEventEmitter;
  gateway: AiProviderGateway;
  feeScheduleSource: StaticFeeScheduleSource;
}

function createContext(): DmtvContext {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the DMTV app.");
  }
  const pool = new Pool({ connectionString: databaseUrl });
  const agentFlowClient = new MockAgentFlowClient();
  const flowraPayClient = new MockFlowraPayClient();
  const events = new DomainEventEmitter(agentFlowClient);
  const gateway = new AiProviderGateway({
    providers: [new MockAiProvider()],
    consentSource: new DbConsentSource(pool),
    creditMeter: new DbCreditMeter(pool),
  });
  const feeScheduleSource = new StaticFeeScheduleSource();
  return { pool, agentFlowClient, flowraPayClient, events, gateway, feeScheduleSource };
}

export function getDmtvContext(): DmtvContext {
  if (!globalThis.__dmtvContext) {
    globalThis.__dmtvContext = createContext();
  }
  return globalThis.__dmtvContext;
}

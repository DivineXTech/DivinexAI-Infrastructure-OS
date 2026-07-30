import type { Queryable } from "@repo/shared";
import type { AgentManifestMetadata } from "./manifest.js";
import type { AgentVersionStatus } from "./agentVersionLifecycle.js";

export interface AgentDefinition {
  id: string;
  slug: string;
  displayName: string;
  role: string;
  description: string;
  ownershipType: "platform";
  createdAt: string;
  updatedAt: string;
}

export interface AgentVersion {
  id: string;
  agentDefinitionId: string;
  version: string;
  manifest: AgentManifestMetadata;
  manifestHash: string;
  status: AgentVersionStatus;
  publishedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string;
}

/**
 * Read/write access to the platform-owned agent catalog
 * (`agent_definitions`/`agent_versions`/`agent_capability_definitions`).
 * Every tenant-facing capability resolves *through* `TenantAgentRegistry`,
 * never straight from this catalog — a platform definition alone is not
 * executable for a tenant (`ADR-0013` addendum).
 */
export interface PlatformAgentCatalog {
  getDefinitionBySlug(slug: string): Promise<AgentDefinition | null>;
  listDefinitions(): Promise<AgentDefinition[]>;
  getVersion(agentVersionId: string): Promise<AgentVersion | null>;
  listPublishedVersions(agentDefinitionId: string): Promise<AgentVersion[]>;
}

type DefinitionRow = {
  id: string;
  slug: string;
  display_name: string;
  role: string;
  description: string;
  ownership_type: "platform";
  created_at: string;
  updated_at: string;
};

function mapDefinition(row: DefinitionRow): AgentDefinition {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    role: row.role,
    description: row.description,
    ownershipType: row.ownership_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type VersionRow = {
  id: string;
  agent_definition_id: string;
  version: string;
  manifest: AgentManifestMetadata;
  manifest_hash: string;
  status: AgentVersionStatus;
  published_at: string | null;
  deprecated_at: string | null;
  created_at: string;
};

function mapVersion(row: VersionRow): AgentVersion {
  return {
    id: row.id,
    agentDefinitionId: row.agent_definition_id,
    version: row.version,
    manifest: row.manifest,
    manifestHash: row.manifest_hash,
    status: row.status,
    publishedAt: row.published_at,
    deprecatedAt: row.deprecated_at,
    createdAt: row.created_at,
  };
}

export class PgPlatformAgentCatalog implements PlatformAgentCatalog {
  constructor(private readonly db: Queryable) {}

  async getDefinitionBySlug(slug: string): Promise<AgentDefinition | null> {
    const { rows } = await this.db.query<DefinitionRow>(
      "select * from agent_definitions where slug = $1",
      [slug],
    );
    return rows[0] ? mapDefinition(rows[0]) : null;
  }

  async listDefinitions(): Promise<AgentDefinition[]> {
    const { rows } = await this.db.query<DefinitionRow>(
      "select * from agent_definitions order by slug",
    );
    return rows.map(mapDefinition);
  }

  async getVersion(agentVersionId: string): Promise<AgentVersion | null> {
    const { rows } = await this.db.query<VersionRow>(
      "select * from agent_versions where id = $1",
      [agentVersionId],
    );
    return rows[0] ? mapVersion(rows[0]) : null;
  }

  async listPublishedVersions(
    agentDefinitionId: string,
  ): Promise<AgentVersion[]> {
    const { rows } = await this.db.query<VersionRow>(
      "select * from agent_versions where agent_definition_id = $1 and status = 'published' order by created_at",
      [agentDefinitionId],
    );
    return rows.map(mapVersion);
  }
}

import { describe, expect, test } from "bun:test";
import type { Asset, ConsentRecord, Contributor, RightsDeclaration } from "@divinexai/schemas";
import {
  validateAssetReadyForPublication,
  validateConsentForProvenance,
  validateOwnershipDeclarations,
  validateRevenueSplits,
} from "./index";

const now = new Date().toISOString();

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset1",
    organizationId: "org1",
    workspaceId: "ws1",
    creatorId: "creator1",
    type: "MUSIC_TRACK",
    title: "Test Track",
    status: "DRAFT",
    source: "AI_GENERATED",
    storagePath: null,
    durationSeconds: 180,
    provenance: [],
    territories: ["WORLDWIDE"],
    commercialUseAuthorized: false,
    publishedAt: null,
    createdAt: now,
    ...overrides,
  };
}

function makeContributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    id: "contrib1",
    assetId: "asset1",
    organizationId: "org1",
    userId: "creator1",
    displayName: "Creator One",
    role: "PRIMARY_ARTIST",
    revenueSplitBps: 10_000,
    createdAt: now,
    ...overrides,
  };
}

function makeRightsDeclaration(overrides: Partial<RightsDeclaration> = {}): RightsDeclaration {
  return {
    id: "rights1",
    assetId: "asset1",
    organizationId: "org1",
    rightsType: "MASTER",
    ownerUserId: "creator1",
    ownershipPct: 100,
    createdAt: now,
    ...overrides,
  };
}

describe("validateRevenueSplits", () => {
  test("passes when splits sum to 100%", () => {
    expect(validateRevenueSplits([makeContributor()]).valid).toBe(true);
  });

  test("fails when splits do not sum to 100%", () => {
    const result = validateRevenueSplits([
      makeContributor({ revenueSplitBps: 6_000 }),
      makeContributor({ id: "contrib2", revenueSplitBps: 3_000 }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/10000 bps/);
  });

  test("fails with no contributors", () => {
    expect(validateRevenueSplits([]).valid).toBe(false);
  });
});

describe("validateOwnershipDeclarations", () => {
  test("music requires both MASTER and PUBLISHING at 100%", () => {
    expect(validateOwnershipDeclarations("MUSIC_TRACK", [makeRightsDeclaration()]).valid).toBe(
      false,
    );
    const result = validateOwnershipDeclarations("MUSIC_TRACK", [
      makeRightsDeclaration({ rightsType: "MASTER" }),
      makeRightsDeclaration({ id: "rights2", rightsType: "PUBLISHING" }),
    ]);
    expect(result.valid).toBe(true);
  });

  test("image only requires MASTER", () => {
    expect(validateOwnershipDeclarations("IMAGE", [makeRightsDeclaration()]).valid).toBe(true);
  });

  test("fails when ownership doesn't sum to 100%", () => {
    const result = validateOwnershipDeclarations("IMAGE", [
      makeRightsDeclaration({ ownershipPct: 60 }),
    ]);
    expect(result.valid).toBe(false);
  });
});

describe("validateConsentForProvenance", () => {
  test("passes when no provenance requires consent", () => {
    const asset = makeAsset();
    expect(validateConsentForProvenance(asset, []).valid).toBe(true);
  });

  test("blocks unauthorized voice cloning", () => {
    const asset = makeAsset({
      provenance: [
        {
          aiJobId: "job1",
          capability: "VOICE",
          providerId: "mock",
          providerModel: "mock-voice-v1",
          sourceAssetIds: [],
          voiceSubjectUserId: "singer1",
          likenessSubjectUserId: null,
        },
      ],
    });
    const result = validateConsentForProvenance(asset, []);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/voice consent/);
  });

  test("allows voice cloning with unrevoked org-scoped consent", () => {
    const asset = makeAsset({
      provenance: [
        {
          aiJobId: "job1",
          capability: "VOICE",
          providerId: "mock",
          providerModel: "mock-voice-v1",
          sourceAssetIds: [],
          voiceSubjectUserId: "singer1",
          likenessSubjectUserId: null,
        },
      ],
    });
    const consent: ConsentRecord = {
      id: "consent1",
      organizationId: "org1",
      subjectType: "VOICE",
      subjectUserId: "singer1",
      grantedByUserId: "singer1",
      scope: "ORGANIZATION_ONLY",
      assetIdScope: [],
      revokedAt: null,
      createdAt: now,
    };
    expect(validateConsentForProvenance(asset, [consent]).valid).toBe(true);
  });

  test("blocks when consent has been revoked", () => {
    const asset = makeAsset({
      provenance: [
        {
          aiJobId: "job1",
          capability: "VOICE",
          providerId: "mock",
          providerModel: "mock-voice-v1",
          sourceAssetIds: [],
          voiceSubjectUserId: "singer1",
          likenessSubjectUserId: null,
        },
      ],
    });
    const consent: ConsentRecord = {
      id: "consent1",
      organizationId: "org1",
      subjectType: "VOICE",
      subjectUserId: "singer1",
      grantedByUserId: "singer1",
      scope: "ORGANIZATION_ONLY",
      assetIdScope: [],
      revokedAt: now,
      createdAt: now,
    };
    expect(validateConsentForProvenance(asset, [consent]).valid).toBe(false);
  });
});

describe("validateAssetReadyForPublication", () => {
  test("passes a fully-declared music asset", () => {
    const result = validateAssetReadyForPublication({
      asset: makeAsset(),
      contributors: [makeContributor()],
      rightsDeclarations: [
        makeRightsDeclaration({ rightsType: "MASTER" }),
        makeRightsDeclaration({ id: "rights2", rightsType: "PUBLISHING" }),
      ],
      consentRecords: [],
      licenses: [],
    });
    expect(result.valid).toBe(true);
  });

  test("fails an asset missing rights declarations", () => {
    const result = validateAssetReadyForPublication({
      asset: makeAsset(),
      contributors: [makeContributor()],
      rightsDeclarations: [],
      consentRecords: [],
      licenses: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

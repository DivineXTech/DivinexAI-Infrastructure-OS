import type {
  Asset,
  AssetType,
  ConsentRecord,
  Contributor,
  LicenseGrant,
  RightsDeclaration,
} from "@divinexai/schemas";

const FULL_SPLIT_BPS = 10_000;
const FULL_OWNERSHIP_PCT = 100;
const OWNERSHIP_EPSILON = 0.01;

/** Which rights types a given asset type must have fully declared before publication. */
export function requiredRightsTypesFor(assetType: AssetType): Array<"MASTER" | "PUBLISHING"> {
  switch (assetType) {
    case "MUSIC_TRACK":
    case "PODCAST_EPISODE":
      return ["MASTER", "PUBLISHING"];
    case "VIDEO":
    case "SHORT_FORM_VIDEO":
    case "IMAGE":
      return ["MASTER"];
    case "LICENSE_BUNDLE":
      return [];
  }
}

export interface RightsValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): RightsValidationResult {
  return { valid: true, errors: [] };
}

export function validateRevenueSplits(contributors: Contributor[]): RightsValidationResult {
  if (contributors.length === 0) {
    return { valid: false, errors: ["At least one contributor is required."] };
  }
  const total = contributors.reduce((sum, c) => sum + c.revenueSplitBps, 0);
  if (total !== FULL_SPLIT_BPS) {
    return {
      valid: false,
      errors: [`Contributor revenue splits must sum to 10000 bps (100%); got ${total}.`],
    };
  }
  return ok();
}

export function validateOwnershipDeclarations(
  assetType: AssetType,
  declarations: RightsDeclaration[],
): RightsValidationResult {
  const errors: string[] = [];
  for (const rightsType of requiredRightsTypesFor(assetType)) {
    const matching = declarations.filter((d) => d.rightsType === rightsType);
    if (matching.length === 0) {
      errors.push(`Missing ${rightsType} rights declaration.`);
      continue;
    }
    const total = matching.reduce((sum, d) => sum + d.ownershipPct, 0);
    if (Math.abs(total - FULL_OWNERSHIP_PCT) > OWNERSHIP_EPSILON) {
      errors.push(`${rightsType} ownership must total 100%; got ${total}%.`);
    }
  }
  return errors.length === 0 ? ok() : { valid: false, errors };
}

/**
 * Whether an unrevoked consent grant exists for this subject, covering
 * either the whole organization or this specific asset. This is the single
 * check that stands between an AI job and unauthorized voice cloning or
 * unauthorized likeness replication — call it before generation and again
 * before publication.
 */
export function hasActiveConsent(
  organizationId: string,
  subjectType: "VOICE" | "LIKENESS",
  subjectUserId: string,
  assetIdScope: string | null,
  consentRecords: ConsentRecord[],
): boolean {
  return consentRecords.some(
    (c) =>
      c.subjectType === subjectType &&
      c.subjectUserId === subjectUserId &&
      c.organizationId === organizationId &&
      c.revokedAt === null &&
      (c.scope === "ORGANIZATION_ONLY" || (assetIdScope !== null && c.assetIdScope.includes(assetIdScope))),
  );
}

/**
 * Enforces that any AI job cloning a voice or replicating a likeness has
 * explicit, unrevoked consent from the subject, scoped to this organization
 * or to the specific asset it feeds into. Prohibits unauthorized voice
 * cloning and unauthorized likeness replication.
 */
export function validateConsentForProvenance(
  asset: Pick<Asset, "id" | "organizationId" | "provenance">,
  consentRecords: ConsentRecord[],
): RightsValidationResult {
  const errors: string[] = [];
  for (const record of asset.provenance) {
    for (const [subjectType, subjectUserId] of [
      ["VOICE", record.voiceSubjectUserId] as const,
      ["LIKENESS", record.likenessSubjectUserId] as const,
    ]) {
      if (!subjectUserId) continue;
      if (!hasActiveConsent(asset.organizationId, subjectType, subjectUserId, asset.id, consentRecords)) {
        errors.push(
          `Missing unrevoked ${subjectType.toLowerCase()} consent from subject ${subjectUserId} for AI job ${record.aiJobId}.`,
        );
      }
    }
  }
  return errors.length === 0 ? ok() : { valid: false, errors };
}

export function validateCommercialLicenses(
  asset: Pick<Asset, "commercialUseAuthorized">,
  licenses: LicenseGrant[],
): RightsValidationResult {
  const errors: string[] = [];
  const now = new Date();
  for (const license of licenses) {
    if (license.commercialUse && !asset.commercialUseAuthorized) {
      errors.push(
        `License ${license.id} grants commercial use but the asset is not marked commercial-use authorized.`,
      );
    }
    if (license.endsAt && new Date(license.endsAt) < now) {
      errors.push(`License ${license.id} has expired.`);
    }
  }
  return errors.length === 0 ? ok() : { valid: false, errors };
}

export interface PublicationRightsCheckInput {
  asset: Asset;
  contributors: Contributor[];
  rightsDeclarations: RightsDeclaration[];
  consentRecords: ConsentRecord[];
  licenses: LicenseGrant[];
}

/** The single gate an asset must pass before it may move from DRAFT/RIGHTS_PENDING to PUBLISHED. */
export function validateAssetReadyForPublication(
  input: PublicationRightsCheckInput,
): RightsValidationResult {
  const results = [
    validateRevenueSplits(input.contributors),
    validateOwnershipDeclarations(input.asset.type, input.rightsDeclarations),
    validateConsentForProvenance(input.asset, input.consentRecords),
    validateCommercialLicenses(input.asset, input.licenses),
  ];
  const errors = results.flatMap((r) => r.errors);
  return errors.length === 0 ? ok() : { valid: false, errors };
}

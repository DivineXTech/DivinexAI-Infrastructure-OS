/**
 * Pure variant-combination generation and duplicate detection. A
 * dimension with no values contributes a single "unset" slot rather than
 * being multiplied away entirely — a product with sizes but no colors
 * still gets one variant per size, not zero variants.
 */

export type VariantCombination = {
  sizeLabel: string | null;
  colorName: string | null;
  garmentStyle: string | null;
  material: string | null;
  printLocation: string | null;
};

export type VariantDimensions = {
  sizes?: string[];
  colors?: string[];
  garmentStyles?: string[];
  materials?: string[];
  printLocations?: string[];
};

function slots(values: string[] | undefined): (string | null)[] {
  return values && values.length > 0 ? values : [null];
}

/** Cartesian product across every provided dimension. */
export function generateVariantMatrix(dimensions: VariantDimensions): VariantCombination[] {
  const combinations: VariantCombination[] = [];
  for (const sizeLabel of slots(dimensions.sizes)) {
    for (const colorName of slots(dimensions.colors)) {
      for (const garmentStyle of slots(dimensions.garmentStyles)) {
        for (const material of slots(dimensions.materials)) {
          for (const printLocation of slots(dimensions.printLocations)) {
            combinations.push({ sizeLabel, colorName, garmentStyle, material, printLocation });
          }
        }
      }
    }
  }
  return combinations;
}

/** Matches the database's null-safe uniqueness expression
 * (product_variants_combo_idx) exactly — coalesce every dimension to "". */
export function combinationKey(combination: VariantCombination): string {
  return [
    combination.sizeLabel,
    combination.colorName,
    combination.garmentStyle,
    combination.material,
    combination.printLocation,
  ]
    .map((value) => value ?? "")
    .join("|");
}

export function findDuplicateCombinations(combinations: VariantCombination[]): VariantCombination[] {
  const seen = new Set<string>();
  const duplicates: VariantCombination[] = [];
  for (const combination of combinations) {
    const key = combinationKey(combination);
    if (seen.has(key)) {
      duplicates.push(combination);
    } else {
      seen.add(key);
    }
  }
  return duplicates;
}

export function isDuplicateCombination(
  candidate: VariantCombination,
  existing: VariantCombination[],
): boolean {
  const candidateKey = combinationKey(candidate);
  return existing.some((combination) => combinationKey(combination) === candidateKey);
}

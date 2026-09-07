import type { CanonicalPart, PartCategory } from '@pcpartcheck/core';

export type PartOf<TCategory extends PartCategory> = Extract<
  CanonicalPart,
  { category: TCategory }
>;

export function partsOf<TCategory extends PartCategory>(
  parts: readonly CanonicalPart[],
  category: TCategory,
): readonly PartOf<TCategory>[] {
  return parts.filter(
    (part): part is PartOf<TCategory> => part.category === category,
  );
}

/**
 * Auto-generated asset tags: `<prefix>-<sequence>`, where the sequence is one
 * past the highest number ever handed out for that prefix in the org.
 *
 * "Ever handed out" is the important part — soft-deleted assets keep their tag
 * and keep occupying the unique {orgId, assetTag} index, so the scan that feeds
 * `nextAssetTagSequence` has to see them too.
 */

export const ASSET_TAG_SEQUENCE_START = 100000

// Bounds the regex so a pathological tag can't overflow the $toLong cast that
// turns the suffix into a number.
const MAX_TAG_DIGITS = 15

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Matches only tags this generator produces, so manual tags can't skew the max. */
export function assetTagPattern(prefix: string): string {
  return `^${escapeRegex(prefix)}-\\d{1,${MAX_TAG_DIGITS}}$`
}

/**
 * No prior tag for this prefix means the org starts at ASSET_TAG_SEQUENCE_START + 1.
 * `highestExisting` arrives from the driver as a number or a BSON Long, so it is
 * coerced rather than typed — but null/undefined must not coerce to 0.
 */
export function nextAssetTagSequence(highestExisting: unknown): number {
  if (highestExisting === null || highestExisting === undefined) return ASSET_TAG_SEQUENCE_START + 1
  const highest = Number(highestExisting)
  return (Number.isFinite(highest) ? highest : ASSET_TAG_SEQUENCE_START) + 1
}

export function formatAssetTag(prefix: string, sequence: number): string {
  return `${prefix}-${sequence}`
}

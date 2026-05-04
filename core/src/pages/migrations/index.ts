/**
 * The schema version this build of the code understands.
 * Bump this and add a Migration entry whenever PageMeta gets a
 * breaking change (rename, type change, removal, required field).
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * One step in the migration chain. Operates on raw frontmatter
 * objects, not typed PageMeta — older shapes don't conform to the
 * current Zod schema.
 */
export interface Migration {
  readonly from: number;
  readonly to: number;
  readonly description: string;
  applyMeta(meta: Record<string, unknown>): Record<string, unknown>;
}

/** Thrown when a chain step is missing between two versions. */
export class MissingMigrationError extends Error {
  constructor(public readonly from: number, public readonly to: number) {
    super(`missing migration step from v${from} to v${to}`);
    this.name = 'MissingMigrationError';
  }
}

/**
 * Thrown when a page's schemaVersion is greater than
 * CURRENT_SCHEMA_VERSION. Indicates the running code is older than
 * the data on disk — pull the latest code.
 */
export class FutureSchemaVersionError extends Error {
  constructor(public readonly fromVersion: number, public readonly current: number) {
    super(`schema v${fromVersion} is newer than this build's v${current} — pull the latest code`);
    this.name = 'FutureSchemaVersionError';
  }
}

/**
 * The migration registry. V1 ships empty; future migrations are
 * imported here in numeric order.
 */
export const MIGRATIONS: readonly Migration[] = [
  // e.g. import { Migration001 } from './001-...'; then add it here.
];

/**
 * Apply migrations in order to bring `meta` from `fromVersion` up to
 * `targetVersion` (default: CURRENT_SCHEMA_VERSION). No-op when already
 * at the target.
 *
 * `registry` is exposed for tests; production callers always use the
 * real MIGRATIONS array.
 *
 * Throws FutureSchemaVersionError when fromVersion > targetVersion.
 * Throws MissingMigrationError if a step is missing in the chain.
 */
export function migrate(
  meta: Record<string, unknown>,
  fromVersion: number,
  registry: readonly Migration[] = MIGRATIONS,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  if (fromVersion > targetVersion) {
    throw new FutureSchemaVersionError(fromVersion, targetVersion);
  }
  let current = fromVersion;
  let result = meta;
  while (current < targetVersion) {
    const step = registry.find((m) => m.from === current);
    if (!step) throw new MissingMigrationError(current, current + 1);
    result = step.applyMeta(result);
    current = step.to;
  }
  return { ...result, schemaVersion: targetVersion };
}

/**
 * Walks 1..targetVersion and asserts that the registry has a
 * contiguous step for every transition. Used at module load and in
 * tests to catch broken releases before any page is touched.
 */
export function validateRegistry(
  registry: readonly Migration[],
  targetVersion: number,
): void {
  for (let v = 1; v < targetVersion; v++) {
    if (!registry.find((m) => m.from === v)) {
      throw new MissingMigrationError(v, v + 1);
    }
  }
}

// Module-load self-check. A broken release fails loudly here, not on
// a random page mid-walk.
validateRegistry(MIGRATIONS, CURRENT_SCHEMA_VERSION);

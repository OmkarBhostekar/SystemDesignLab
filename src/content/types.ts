/**
 * The stable metadata contract stored in an indexed lesson's YAML frontmatter.
 *
 * Lesson prose intentionally does not belong to this type.  The source file
 * remains the source of truth and is loaded separately by `loadLessonSource`.
 */
export type LessonDifficulty = "core" | "advanced" | "deep-dive";

export type LessonFrontmatter = {
  type: "lesson";
  id: string;
  slug: string;
  title: string;
  description: string;
  module: CanonicalModuleId;
  order: number;
  difficulty: LessonDifficulty;
  estimatedMinutes: number;
  prerequisites: string[];
  tags: string[];
  objectives: string[];
  visualizationId?: string | null;
  quizId?: string | null;
  relatedLessons: string[];
  aliases: string[];
};

export const MODULE_DIRECTORY_BY_ID = {
  "interview-method": "00-interview-method",
  foundations: "01-foundations",
  networking: "02-networking",
  "traffic-and-services": "03-traffic-and-services",
  databases: "04-databases",
  caching: "05-caching",
  messaging: "06-messaging",
  "distributed-coordination": "07-distributed-coordination",
  reliability: "08-reliability",
  observability: "09-observability",
  security: "10-security",
  "building-blocks": "11-building-blocks",
  "architecture-archetypes": "12-architecture-archetypes",
  "design-labs": "13-design-labs",
} as const;

export type CanonicalModuleId = keyof typeof MODULE_DIRECTORY_BY_ID;
export const CANONICAL_MODULE_IDS = Object.keys(
  MODULE_DIRECTORY_BY_ID,
) as CanonicalModuleId[];
export const CANONICAL_MODULE_DIRECTORIES = Object.values(
  MODULE_DIRECTORY_BY_ID,
);

export type LocalSourceLinkKind = "lesson" | "asset" | "file";

export type LocalSourceLink = {
  /** The link exactly as authored in the MDX source. */
  href: string;
  /** Link text for Markdown links, or the empty string for image links. */
  label: string;
  /** Whether this was an image link. */
  isImage: boolean;
  /** Source path relative to the project root, when it resolves locally. */
  sourcePath: string;
  /** The fragment without the leading `#`, if one was authored. */
  fragment?: string;
  kind: LocalSourceLinkKind;
  /** Lesson ID and canonical route are present for lesson links. */
  lessonId?: string;
  route?: string;
};

export type LessonRecord = LessonFrontmatter & {
  /** Source path relative to the project root (for example, theory/01-foundations/cap.mdx). */
  sourcePath: string;
  /** Alias retained for callers that prefer an explicit relative name. */
  relativeSourcePath: string;
  /** Canonical application route for this lesson. */
  route: string;
  /** Stable heading slugs derived from the source body. */
  headings: string[];
  /** Validated local links in source order. */
  localLinks: LocalSourceLink[];
  /** Relationship IDs after resolution. These are intentionally IDs, not prose or nested records. */
  resolvedPrerequisites: string[];
  resolvedRelatedLessons: string[];
};

export type ModuleRecord = {
  id: CanonicalModuleId;
  /** Numeric directory name, e.g. `01-foundations`. */
  directory: string;
  /** Human-readable title derived from the canonical module ID. */
  title: string;
  /** Canonical curriculum position, starting at zero. */
  order: number;
  lessons: LessonRecord[];
};

export type ContentIndex = {
  version: 1;
  modules: ModuleRecord[];
  lessons: LessonRecord[];
  /** Serializable lookup tables for route/server consumers. */
  lessonById: Record<string, LessonRecord>;
  moduleById: Record<string, ModuleRecord>;
};

export type LessonSource = {
  /** Body after the one YAML frontmatter block, without duplicating metadata. */
  body: string;
  /** Absolute filesystem path used to read the source. */
  absolutePath: string;
  /** Project-relative path, matching `LessonRecord.sourcePath`. */
  sourcePath: string;
};

export type ContentIssueCode =
  | "frontmatter-missing"
  | "frontmatter-multiple"
  | "frontmatter-malformed"
  | "schema"
  | "duplicate-id"
  | "duplicate-slug"
  | "duplicate-order"
  | "duplicate-alias"
  | "path-module-mismatch"
  | "unresolved-reference"
  | "self-reference"
  | "dependency-cycle"
  | "broken-local-link"
  | "malformed-external-link"
  | "unregistered-visualization"
  | "unregistered-quiz"
  | "filesystem";

export type ContentIssue = {
  path: string;
  /** Field path such as `prerequisites[0]`, `frontmatter`, or `links`. */
  field: string;
  code: ContentIssueCode;
  message: string;
};

export type ContentWarning = {
  path: string;
  field: string;
  message: string;
};

export class ContentValidationError extends Error {
  readonly issues: ContentIssue[];
  readonly warnings: ContentWarning[];

  constructor(issues: ContentIssue[], warnings: ContentWarning[] = []) {
    const sorted = [...issues].sort(compareIssues);
    super(
      [
        `Content validation failed with ${sorted.length} error${sorted.length === 1 ? "" : "s"}.`,
        ...sorted.map((issue) => `${issue.path}: ${issue.field}: ${issue.message}`),
      ].join("\n"),
    );
    this.name = "ContentValidationError";
    this.issues = sorted;
    this.warnings = [...warnings].sort(compareWarnings);
  }
}

export type ContentValidationResult = {
  ok: boolean;
  errors: ContentIssue[];
  warnings: ContentWarning[];
  lessonCount: number;
  moduleCount: number;
  index?: ContentIndex;
};

export type ContentLoaderOptions = {
  /** Project root used for stable source paths. Defaults to `process.cwd()`. */
  projectRoot?: string;
  /** Alias for `projectRoot`, retained for route/build integrations. */
  rootDir?: string;
  /** Absolute or project-relative theory directory. Defaults to `<projectRoot>/theory`. */
  theoryRoot?: string;
  /** Alias for `theoryRoot`, useful for isolated fixture trees. */
  contentRoot?: string;
  /** Explicit lesson files. When supplied, directory scanning is skipped. */
  lessonPaths?: string[];
  /** Include canonical module records that have no indexed lessons. */
  includeEmptyModules?: boolean;
  /** Disable local source link checks only for specialized callers. */
  validateLocalLinks?: boolean;
  /** A provided registry enables validation for that registry. Omit until a registry exists. */
  visualizationIds?: Iterable<string>;
  /** A provided registry enables validation for that registry. Omit until a registry exists. */
  quizIds?: Iterable<string>;
};

export type SourceLinkResolution =
  | { kind: "external"; href: string }
  | { kind: "anchor"; href: string; fragment: string; route: string }
  | { kind: "lesson"; href: string; fragment?: string; lessonId: string; route: string }
  | { kind: "local"; href: string; fragment?: string; sourcePath: string };

export function compareIssues(a: ContentIssue, b: ContentIssue): number {
  return (
    a.path.localeCompare(b.path) ||
    a.field.localeCompare(b.field) ||
    a.code.localeCompare(b.code) ||
    a.message.localeCompare(b.message)
  );
}

export function compareWarnings(a: ContentWarning, b: ContentWarning): number {
  return a.path.localeCompare(b.path) || a.field.localeCompare(b.field) || a.message.localeCompare(b.message);
}

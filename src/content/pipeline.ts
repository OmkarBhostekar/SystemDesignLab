import fs from "node:fs";
import path from "node:path";

import {
  CANONICAL_MODULE_IDS,
  CANONICAL_MODULE_DIRECTORIES,
  ContentIndex,
  ContentIssue,
  ContentLoaderOptions,
  ContentValidationError,
  ContentValidationResult,
  ContentWarning,
  LessonRecord,
  ModuleRecord,
  MODULE_DIRECTORY_BY_ID,
} from "./types";
import { parseLessonSource, ParsedLessonSource } from "./frontmatter";
import { validateSourceLinks } from "./links";

type ParsedFile = {
  absolutePath: string;
  projectRelativePath: string;
  moduleDirectory: string;
  parsed?: ParsedLessonSource;
};

type EffectiveOptions = Required<Pick<ContentLoaderOptions, "projectRoot" | "theoryRoot" | "validateLocalLinks">> &
  Omit<ContentLoaderOptions, "projectRoot" | "theoryRoot" | "validateLocalLinks">;

const MODULE_TITLE_OVERRIDES: Partial<Record<(typeof CANONICAL_MODULE_IDS)[number], string>> = {
  "interview-method": "Interview Method",
  foundations: "Foundations",
  networking: "Networking and Communication",
  "traffic-and-services": "Traffic Distribution and Service Architecture",
  databases: "Data and Databases",
  caching: "Caching",
  messaging: "Asynchronous Systems and Messaging",
  "distributed-coordination": "Distributed Coordination and Consistency",
  reliability: "Reliability and Failure Engineering",
  observability: "Observability",
  security: "Security for System Design",
  "building-blocks": "Reusable Interview Building Blocks",
  "architecture-archetypes": "Architecture Archetypes",
  "design-labs": "Interview Design Labs",
};

/** Build and validate the deterministic index for all theory lessons. */
export function loadContentIndex(options: ContentLoaderOptions = {}): ContentIndex {
  const result = validateContent(options);
  if (!result.ok || !result.index) {
    throw new ContentValidationError(result.errors, result.warnings);
  }
  return result.index;
}

/** Alias used by build scripts and callers that prefer “build” terminology. */
export const buildContentIndex = loadContentIndex;

/**
 * Validate content without throwing.  This is useful for editor integrations
 * and the CLI, while `loadContentIndex` remains the fail-fast application API.
 */
export function validateContent(options: ContentLoaderOptions = {}): ContentValidationResult {
  const effective = normalizeOptions(options);
  const issues: ContentIssue[] = [];
  const warnings: ContentWarning[] = [];
  let files: ParsedFile[] = [];

  try {
    files = discoverLessonFiles(effective).map((absolutePath) => {
      const projectRelativePath = toProjectRelativePath(absolutePath, effective.projectRoot);
      const relativeToTheory = path.relative(effective.theoryRoot, absolutePath);
      const moduleDirectory = relativeToTheory.split(path.sep)[0] ?? "";
      return { absolutePath, projectRelativePath, moduleDirectory };
    });
  } catch (error) {
    issues.push({
      path: effective.theoryRoot,
      field: "theoryRoot",
      code: "filesystem",
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, errors: issues, warnings, lessonCount: 0, moduleCount: 0 };
  }

  const parsedFiles: ParsedFile[] = [];
  for (const file of files) {
    let source: string;
    try {
      source = fs.readFileSync(file.absolutePath, "utf8");
    } catch (error) {
      issues.push({
        path: file.projectRelativePath,
        field: "source",
        code: "filesystem",
        message: `unable to read lesson source: ${error instanceof Error ? error.message : String(error)}`,
      });
      parsedFiles.push(file);
      continue;
    }

    const parsed = parseLessonSource(source, file.projectRelativePath);
    if (!parsed.ok) {
      issues.push(...parsed.issues);
      parsedFiles.push(file);
      continue;
    }
    file.parsed = parsed.value;
    parsedFiles.push(file);
  }

  const lessons = parsedFiles
    .filter((file): file is ParsedFile & { parsed: ParsedLessonSource } => Boolean(file.parsed))
    .map((file) => file.parsed.data);

  // We collect duplicate and path errors before relationship checks. That way
  // one bad authoring change reports all useful fixes in one command.
  const idOwners = collectOwners(parsedFiles, (file) => file.parsed?.data.id);
  for (const [id, owners] of idOwners) {
    if (owners.length < 2) continue;
    for (const owner of owners) {
      issues.push({
        path: owner.projectRelativePath,
        field: "id",
        code: "duplicate-id",
        message: `lesson ID ${JSON.stringify(id)} is also declared by ${owners
          .filter((other) => other !== owner)
          .map((other) => other.projectRelativePath)
          .join(", ")}`,
      });
    }
  }

  const slugOwners = collectOwners(parsedFiles, (file) =>
    file.parsed ? `${file.parsed.data.module}\u0000${file.parsed.data.slug}` : undefined,
  );
  for (const [pair, owners] of slugOwners) {
    if (owners.length < 2) continue;
    const [module, slug] = pair.split("\u0000");
    for (const owner of owners) {
      issues.push({
        path: owner.projectRelativePath,
        field: "slug",
        code: "duplicate-slug",
        message: `module/slug pair ${module}/${slug} is also declared by ${owners
          .filter((other) => other !== owner)
          .map((other) => other.projectRelativePath)
          .join(", ")}`,
      });
    }
  }

  const orderOwners = collectOwners(parsedFiles, (file) =>
    file.parsed ? `${file.parsed.data.module}\u0000${file.parsed.data.order}` : undefined,
  );
  for (const [pair, owners] of orderOwners) {
    if (owners.length < 2) continue;
    const [module, order] = pair.split("\u0000");
    for (const owner of owners) {
      issues.push({
        path: owner.projectRelativePath,
        field: "order",
        code: "duplicate-order",
        message: `order ${order} is duplicated within module ${module}; also declared by ${owners
          .filter((other) => other !== owner)
          .map((other) => other.projectRelativePath)
          .join(", ")}`,
      });
    }
  }

  const aliasOwners = new Map<string, ParsedFile[]>();
  for (const file of parsedFiles) {
    for (const alias of file.parsed?.data.aliases ?? []) {
      const owners = aliasOwners.get(alias) ?? [];
      owners.push(file);
      aliasOwners.set(alias, owners);
    }
  }
  for (const [alias, owners] of aliasOwners) {
    if (owners.length < 2) continue;
    for (const owner of owners) {
      issues.push({
        path: owner.projectRelativePath,
        field: "aliases",
        code: "duplicate-alias",
        message: `alias ${JSON.stringify(alias)} is also declared by ${owners
          .filter((other) => other !== owner)
          .map((other) => other.projectRelativePath)
          .join(", ")}`,
      });
    }
  }

  const canonicalNames = new Map<string, ParsedFile[]>();
  for (const file of parsedFiles) {
    if (!file.parsed) continue;
    const names = [file.parsed.data.id, file.parsed.data.slug, ...file.parsed.data.aliases];
    for (const name of names) {
      const owners = canonicalNames.get(name) ?? [];
      owners.push(file);
      canonicalNames.set(name, owners);
    }
  }
  for (const [name, owners] of canonicalNames) {
    const uniqueOwners = [...new Set(owners)];
    const aliasOnlyOwners = uniqueOwners.filter((owner) => owner.parsed?.data.aliases.includes(name));
    if (aliasOnlyOwners.length === 0) continue;
    for (const owner of aliasOnlyOwners) {
      if (owner.parsed?.data.id === name || owner.parsed?.data.slug === name) {
        issues.push({
          path: owner.projectRelativePath,
          field: "aliases",
          code: "duplicate-alias",
          message: `alias ${JSON.stringify(name)} duplicates this lesson's published ID or slug`,
        });
        continue;
      }
      if (uniqueOwners.length < 2) continue;
      issues.push({
        path: owner.projectRelativePath,
        field: "aliases",
        code: "duplicate-alias",
        message: `alias ${JSON.stringify(name)} conflicts with a published lesson ID or slug`,
      });
    }
  }

  const validModuleDirectories = new Set<string>(CANONICAL_MODULE_DIRECTORIES);
  for (const file of parsedFiles) {
    if (!file.parsed) continue;
    const expectedDirectory = MODULE_DIRECTORY_BY_ID[file.parsed.data.module];
    if (!validModuleDirectories.has(file.moduleDirectory) || file.moduleDirectory !== expectedDirectory) {
      issues.push({
        path: file.projectRelativePath,
        field: "module",
        code: "path-module-mismatch",
        message: `module ${JSON.stringify(file.parsed.data.module)} belongs under ${expectedDirectory}/, but the source is under ${file.moduleDirectory || "theory/"}`,
      });
    }
  }

  const byId = new Map<string, ParsedFile>();
  for (const file of parsedFiles) {
    const id = file.parsed?.data.id;
    if (id && !byId.has(id)) byId.set(id, file);
  }

  for (const file of parsedFiles) {
    if (!file.parsed) continue;
    const metadata = file.parsed.data;
    validateRelationships(metadata.prerequisites, "prerequisites", metadata.id, file, byId, issues);
    validateRelationships(metadata.relatedLessons, "relatedLessons", metadata.id, file, byId, issues);

    if (effective.visualizationIds && metadata.visualizationId && !setHas(effective.visualizationIds, metadata.visualizationId)) {
      issues.push({
        path: file.projectRelativePath,
        field: "visualizationId",
        code: "unregistered-visualization",
        message: `visualization ID ${JSON.stringify(metadata.visualizationId)} is not registered`,
      });
    }
    if (effective.quizIds && metadata.quizId && !setHas(effective.quizIds, metadata.quizId)) {
      issues.push({
        path: file.projectRelativePath,
        field: "quizId",
        code: "unregistered-quiz",
        message: `quiz ID ${JSON.stringify(metadata.quizId)} is not registered`,
      });
    }
  }

  detectPrerequisiteCycles(parsedFiles, byId, issues);

  if (effective.validateLocalLinks) {
    const knownSourcePaths = new Set(
      parsedFiles
        .filter((file) => Boolean(file.parsed))
        .map((file) => normalizeProjectPath(file.projectRelativePath)),
    );
    for (const file of parsedFiles) {
      if (!file.parsed) continue;
      const linkResult = validateSourceLinks({
        body: file.parsed.body,
        sourceAbsolutePath: file.absolutePath,
        projectRoot: effective.projectRoot,
        theoryRoot: effective.theoryRoot,
        sourcePath: file.projectRelativePath,
        knownSourcePaths,
        knownLessons: byId,
        knownHeadings: new Map(
          parsedFiles
            .filter((candidate) => Boolean(candidate.parsed))
            .map((candidate) => [
              normalizeProjectPath(candidate.projectRelativePath),
              new Set(candidate.parsed?.headings ?? []),
            ]),
        ),
      });
      issues.push(...linkResult.errors);
      warnings.push(...linkResult.warnings);
    }
  }

  if (issues.length > 0) {
    const moduleCount = new Set(lessons.map((lesson) => lesson.module)).size;
    return {
      ok: false,
      errors: sortIssues(issues),
      warnings: sortWarnings(warnings),
      lessonCount: lessons.length,
      moduleCount,
    };
  }

  const index = createIndex(parsedFiles, effective);
  return {
    ok: true,
    errors: [],
    warnings: sortWarnings(warnings),
    lessonCount: index.lessons.length,
    moduleCount: index.modules.length,
    index,
  };
}

function normalizeOptions(options: ContentLoaderOptions): EffectiveOptions {
  const projectRoot = path.resolve(/*turbopackIgnore: true*/ options.projectRoot ?? options.rootDir ?? process.cwd());
  const theoryRoot = path.resolve(
    projectRoot,
    options.contentRoot ?? options.theoryRoot ?? "theory",
  );
  return {
    ...options,
    projectRoot,
    theoryRoot,
    validateLocalLinks: options.validateLocalLinks ?? true,
  };
}

function discoverLessonFiles(options: EffectiveOptions): string[] {
  if (options.lessonPaths) {
    return [...new Set(options.lessonPaths.map((file) => path.resolve(options.projectRoot, file)))].sort(comparePaths);
  }
  if (!fs.existsSync(options.theoryRoot)) {
    throw new Error(`theory directory does not exist: ${options.theoryRoot}`);
  }
  const files: string[] = [];
  walk(options.theoryRoot, files);
  return files.sort(comparePaths);
}

function walk(directory: string, files: string[]): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mdx")) {
      files.push(entryPath);
    }
  }
}

function collectOwners(
  files: ParsedFile[],
  keyOf: (file: ParsedFile) => string | undefined,
): Map<string, ParsedFile[]> {
  const owners = new Map<string, ParsedFile[]>();
  for (const file of files) {
    const key = keyOf(file);
    if (!key) continue;
    const current = owners.get(key) ?? [];
    current.push(file);
    owners.set(key, current);
  }
  return owners;
}

function validateRelationships(
  values: string[],
  field: "prerequisites" | "relatedLessons",
  lessonId: string,
  owner: ParsedFile,
  byId: Map<string, ParsedFile>,
  issues: ContentIssue[],
): void {
  values.forEach((reference, index) => {
    const referenced = byId.get(reference);
    if (!referenced) {
      issues.push({
        path: owner.projectRelativePath,
        field: `${field}[${index}]`,
        code: "unresolved-reference",
        message: `${field} reference ${JSON.stringify(reference)} does not resolve to an indexed lesson ID`,
      });
      return;
    }
    if (reference === lessonId) {
      issues.push({
        path: owner.projectRelativePath,
        field: `${field}[${index}]`,
        code: "self-reference",
        message: `lesson ${JSON.stringify(lessonId)} cannot reference itself in ${field}`,
      });
    }
  });
}

function detectPrerequisiteCycles(
  files: ParsedFile[],
  byId: Map<string, ParsedFile>,
  issues: ContentIssue[],
): void {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const reported = new Set<string>();

  const visit = (id: string): void => {
    const currentState = state.get(id) ?? 0;
    if (currentState === 2) return;
    if (currentState === 1) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      const key = canonicalCycle(cycle);
      if (!reported.has(key)) {
        reported.add(key);
        const owner = byId.get(id);
        if (owner) {
          issues.push({
            path: owner.projectRelativePath,
            field: "prerequisites",
            code: "dependency-cycle",
            message: `prerequisite cycle detected: ${cycle.join(" -> ")}`,
          });
        }
      }
      return;
    }

    const owner = byId.get(id);
    if (!owner?.parsed) return;
    state.set(id, 1);
    stack.push(id);
    for (const prerequisite of owner.parsed.data.prerequisites) {
      if (byId.has(prerequisite)) visit(prerequisite);
    }
    stack.pop();
    state.set(id, 2);
  };

  for (const file of files) {
    if (file.parsed) visit(file.parsed.data.id);
  }
}

function canonicalCycle(cycle: string[]): string {
  const nodes = cycle.slice(0, -1);
  if (nodes.length === 0) return "";
  const rotations = nodes.map((_, index) => [...nodes.slice(index), ...nodes.slice(0, index)].join("->"));
  return rotations.sort()[0];
}

function createIndex(files: ParsedFile[], options: EffectiveOptions): ContentIndex {
  const records = files
    .filter((file): file is ParsedFile & { parsed: ParsedLessonSource } => Boolean(file.parsed))
    .map((file): LessonRecord => {
      const metadata = file.parsed.data;
      return {
        ...metadata,
        sourcePath: file.projectRelativePath,
        relativeSourcePath: file.projectRelativePath,
        route: lessonRoute(metadata.module, metadata.slug),
        headings: file.parsed.headings,
        localLinks: [],
        resolvedPrerequisites: [...metadata.prerequisites],
        resolvedRelatedLessons: [...metadata.relatedLessons],
      };
    });

  const sortedLessons = records.sort(compareLessons);
  const lessonById: Record<string, LessonRecord> = {};
  for (const lesson of sortedLessons) lessonById[lesson.id] = lesson;

  // Link metadata was validated before this point. Populate validated local
  // links without rereading or storing lesson prose in the index.
  for (const record of sortedLessons) {
    const source = files.find((file) => file.projectRelativePath === record.sourcePath);
    if (!source?.parsed) continue;
    const links = validateSourceLinks({
      body: source.parsed.body,
      sourceAbsolutePath: source.absolutePath,
      projectRoot: options.projectRoot,
      theoryRoot: options.theoryRoot,
      sourcePath: source.projectRelativePath,
      knownSourcePaths: new Set(files.map((file) => normalizeProjectPath(file.projectRelativePath))),
      knownLessons: new Map(
        sortedLessons.map((lesson) => [
          lesson.id,
          { sourcePath: lesson.sourcePath, parsed: { data: lesson } },
        ]),
      ),
      knownHeadings: new Map(
        sortedLessons.map((lesson) => [lesson.sourcePath, new Set(lesson.headings)]),
      ),
    });
    record.localLinks = links.links;
  }

  const moduleById: Record<string, ModuleRecord> = {};
  const modules = CANONICAL_MODULE_IDS.filter(
    (moduleId) => options.includeEmptyModules || sortedLessons.some((lesson) => lesson.module === moduleId),
  ).map((moduleId): ModuleRecord => {
    const record: ModuleRecord = {
      id: moduleId,
      directory: MODULE_DIRECTORY_BY_ID[moduleId],
      title: MODULE_TITLE_OVERRIDES[moduleId] ?? titleFromModuleId(moduleId),
      order: moduleOrderForId(moduleId),
      lessons: sortedLessons.filter((lesson) => lesson.module === moduleId),
    };
    moduleById[moduleId] = record;
    return record;
  });

  return {
    version: 1,
    modules,
    lessons: sortedLessons,
    lessonById,
    moduleById,
  };
}

function compareLessons(a: LessonRecord, b: LessonRecord): number {
  return (
    moduleOrder(a.module) - moduleOrder(b.module) ||
    a.order - b.order ||
    a.id.localeCompare(b.id) ||
    a.sourcePath.localeCompare(b.sourcePath)
  );
}

function moduleOrder(moduleId: string): number {
  const order = CANONICAL_MODULE_IDS.indexOf(moduleId as (typeof CANONICAL_MODULE_IDS)[number]);
  return order < 0 ? Number.MAX_SAFE_INTEGER : order;
}

function moduleOrderForId(moduleId: (typeof CANONICAL_MODULE_IDS)[number]): number {
  return CANONICAL_MODULE_IDS.indexOf(moduleId);
}

function titleFromModuleId(id: string): string {
  return id
    .split("-")
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function setHas(values: Iterable<string>, value: string): boolean {
  if (values instanceof Set) return values.has(value);
  return new Set(values).has(value);
}

function lessonRoute(moduleId: string, slug: string): string {
  return `/learn/${moduleId}/${slug}`;
}

export function getLessonRoute(lesson: Pick<LessonRecord, "module" | "slug">): string {
  return lessonRoute(lesson.module, lesson.slug);
}

export function getModuleRoute(moduleId: string): string {
  return `/learn/${moduleId}`;
}

export function resolveLesson(
  index: ContentIndex,
  idOrModule: string,
  slug?: string,
): LessonRecord | undefined {
  if (slug !== undefined) {
    return index.lessons.find(
      (lesson) => lesson.module === idOrModule && (lesson.slug === slug || lesson.aliases.includes(slug)),
    );
  }
  return index.lessonById[idOrModule];
}

export function resolveModule(index: ContentIndex, moduleId: string): ModuleRecord | undefined {
  return index.moduleById[moduleId];
}

export function getPreviousLesson(index: ContentIndex, lesson: Pick<LessonRecord, "id" | "module" | "order">): LessonRecord | undefined {
  const moduleRecord = resolveModule(index, lesson.module);
  if (!moduleRecord) return undefined;
  const indexInModule = moduleRecord.lessons.findIndex((candidate) => candidate.id === lesson.id);
  return indexInModule > 0 ? moduleRecord.lessons[indexInModule - 1] : undefined;
}

export function getNextLesson(index: ContentIndex, lesson: Pick<LessonRecord, "id" | "module" | "order">): LessonRecord | undefined {
  const moduleRecord = resolveModule(index, lesson.module);
  if (!moduleRecord) return undefined;
  const indexInModule = moduleRecord.lessons.findIndex((candidate) => candidate.id === lesson.id);
  return indexInModule >= 0 && indexInModule < moduleRecord.lessons.length - 1
    ? moduleRecord.lessons[indexInModule + 1]
    : undefined;
}

/** Familiar aliases for route components. */
export const getPrevious = getPreviousLesson;
export const getNext = getNextLesson;

export function loadLessonSource(
  lesson: Pick<LessonRecord, "sourcePath"> | string,
  options: ContentLoaderOptions = {},
): import("./types").LessonSource {
  const effective = normalizeOptions(options);
  const sourcePath = typeof lesson === "string" ? lesson : lesson.sourcePath;
  const absolutePath = path.resolve(effective.projectRoot, sourcePath);
  if (!isWithin(effective.projectRoot, absolutePath)) {
    throw new Error(`lesson source path escapes project root: ${sourcePath}`);
  }
  const source = fs.readFileSync(/*turbopackIgnore: true*/ absolutePath, "utf8");
  const parsed = parseLessonSource(source, sourcePath);
  if (!parsed.ok) throw new ContentValidationError(parsed.issues);
  return { body: parsed.value.body, absolutePath, sourcePath: toProjectRelativePath(absolutePath, effective.projectRoot) };
}

export function readLessonSource(
  index: ContentIndex,
  idOrModule: string,
  slug?: string,
  options: ContentLoaderOptions = {},
): import("./types").LessonSource | undefined {
  const lesson = resolveLesson(index, idOrModule, slug);
  return lesson ? loadLessonSource(lesson, options) : undefined;
}

function toProjectRelativePath(absolutePath: string, projectRoot: string): string {
  return normalizeProjectPath(path.relative(projectRoot, absolutePath));
}

function normalizeProjectPath(value: string): string {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function comparePaths(a: string, b: string): number {
  return normalizeProjectPath(a).localeCompare(normalizeProjectPath(b));
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function sortIssues(issues: ContentIssue[]): ContentIssue[] {
  return [...issues].sort((a, b) => a.path.localeCompare(b.path) || a.field.localeCompare(b.field) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
}

function sortWarnings(warnings: ContentWarning[]): ContentWarning[] {
  return [...warnings].sort((a, b) => a.path.localeCompare(b.path) || a.field.localeCompare(b.field) || a.message.localeCompare(b.message));
}

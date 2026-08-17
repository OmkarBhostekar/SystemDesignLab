import matter from "gray-matter";
import { z } from "zod";

import {
  CANONICAL_MODULE_IDS,
  ContentIssue,
  LessonFrontmatter,
} from "./types";

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const nonEmptyString = z.string().trim().min(1);
const identifier = nonEmptyString.regex(KEBAB_CASE, "must be lowercase kebab-case");

/**
 * Public schema for callers that want to validate already parsed metadata.
 * Defaults are applied only to optional relationship fields; required fields
 * remain required so a typo cannot silently create an incomplete lesson.
 */
export const lessonFrontmatterSchema = z
  .object({
    type: z.literal("lesson"),
    id: identifier,
    slug: identifier,
    title: nonEmptyString,
    description: nonEmptyString,
    module: z.enum(CANONICAL_MODULE_IDS as [string, ...string[]]),
    order: z.number().int().positive(),
    difficulty: z.enum(["core", "advanced", "deep-dive"]),
    estimatedMinutes: z.number().int().positive(),
    prerequisites: z.array(identifier),
    tags: z.array(identifier),
    objectives: z.array(nonEmptyString),
    visualizationId: identifier.nullable().optional(),
    quizId: identifier.nullable().optional(),
    relatedLessons: z.array(identifier).default([]),
    aliases: z.array(identifier).default([]),
  })
  .strict();

export type ParsedLessonSource = {
  data: LessonFrontmatter;
  body: string;
  headings: string[];
};

export type FrontmatterParseResult =
  | { ok: true; value: ParsedLessonSource }
  | { ok: false; issues: ContentIssue[] };

function issue(
  path: string,
  field: string,
  code: ContentIssue["code"],
  message: string,
): ContentIssue {
  return { path, field, code, message };
}

/**
 * Parse one lesson source and derive its heading slugs.  We deliberately do
 * not use `matter.test` alone: it accepts a number of delimiter forms and
 * does not make the one-frontmatter-block rule explicit enough for a build
 * gate.
 */
export function parseLessonSource(
  source: string,
  sourcePath = "<lesson>",
): FrontmatterParseResult {
  const normalized = source.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);

  if (lines[0]?.trim() !== "---") {
    return {
      ok: false,
      issues: [
        issue(
          sourcePath,
          "frontmatter",
          "frontmatter-missing",
          "lesson must start with exactly one YAML frontmatter block delimited by ---",
        ),
      ],
    };
  }

  let closingLine = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      closingLine = index;
      break;
    }
  }

  if (closingLine < 0) {
    return {
      ok: false,
      issues: [
        issue(
          sourcePath,
          "frontmatter",
          "frontmatter-malformed",
          "frontmatter opening delimiter has no closing --- delimiter",
        ),
      ],
    };
  }

  const frontmatterText = lines.slice(1, closingLine).join("\n");
  let parsed: Record<string, unknown>;
  try {
    // gray-matter's YAML engine is the project's existing frontmatter parser.
    // Parsing the extracted block keeps body horizontal rules from being
    // mistaken for a second frontmatter block.
    parsed = matter(`---\n${frontmatterText}\n---\n`).data as Record<string, unknown>;
  } catch (error) {
    return {
      ok: false,
      issues: [
        issue(
          sourcePath,
          "frontmatter",
          "frontmatter-malformed",
          `invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
    };
  }

  const result = lessonFrontmatterSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((zodIssue) => {
      const field =
        zodIssue.code === "unrecognized_keys" && zodIssue.keys.length > 0
          ? `frontmatter.${zodIssue.keys.join(",")}`
          : zodIssue.path.length > 0
            ? formatFieldPath(zodIssue.path)
            : "frontmatter";
      return issue(sourcePath, field, "schema", formatZodIssue(zodIssue.message));
    });
    return { ok: false, issues };
  }

  // `zod` knows the shape but not relationship-list uniqueness.  Keeping this
  // check here gives the author the exact offending field before graph work.
  const data = result.data as LessonFrontmatter;
  const listIssues = validateListUniqueness(data, sourcePath);
  if (listIssues.length > 0) return { ok: false, issues: listIssues };

  const body = lines.slice(closingLine + 1).join("\n");
  if (body.trim().length === 0) {
    return {
      ok: false,
      issues: [
        issue(sourcePath, "body", "schema", "lesson body must contain readable Markdown/MDX content"),
      ],
    };
  }

  const bodyLines = body.split(/\r?\n/);
  const startsWithSecondDelimiter = bodyLines.findIndex((line) => line.trim().length > 0) >= 0
    ? bodyLines[bodyLines.findIndex((line) => line.trim().length > 0)].trim() === "---"
    : false;
  const secondDelimiterHasMetadata = startsWithSecondDelimiter && bodyLines
    .slice(bodyLines.findIndex((line) => line.trim().length > 0) + 1)
    .some((line) => /^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(line));
  if (secondDelimiterHasMetadata) {
    return {
      ok: false,
      issues: [
        issue(
          sourcePath,
          "frontmatter",
          "frontmatter-multiple",
          "lesson contains more than one YAML frontmatter block; only the opening block is allowed",
        ),
      ],
    };
  }

  return {
    ok: true,
    value: {
      data,
      body,
      headings: deriveHeadingSlugs(body),
    },
  };
}

function validateListUniqueness(data: LessonFrontmatter, sourcePath: string): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const [field, values] of [
    ["prerequisites", data.prerequisites],
    ["tags", data.tags],
    ["objectives", data.objectives],
    ["relatedLessons", data.relatedLessons],
    ["aliases", data.aliases],
  ] as const) {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) {
        issues.push(
          issue(
            sourcePath,
            `${field}[${index}]`,
            "schema",
            `duplicate value ${JSON.stringify(value)}; values in ${field} must be unique`,
          ),
        );
      }
      seen.add(value);
    });
  }
  return issues;
}

function formatFieldPath(path: PropertyKey[]): string {
  return path
    .map((part, index) =>
      typeof part === "number" ? `[${part}]` : index === 0 ? String(part) : `.${String(part)}`,
    )
    .join("");
}

function formatZodIssue(message: string): string {
  return message.endsWith(".") ? message : `${message}.`;
}

/**
 * Derive the same stable, duplicate-suffixed heading slugs used by common
 * Markdown renderers.  This is metadata only; it does not render MDX.
 */
export function deriveHeadingSlugs(body: string): string[] {
  const slugs: string[] = [];
  const occurrences = new Map<string, number>();
  let inFence = false;

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const raw = match[1]
      .replace(/\[[^\]]*\]\([^)]*\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .trim();
    const base = slugifyHeading(raw);
    if (!base) continue;
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    slugs.push(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

export function slugifyHeading(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

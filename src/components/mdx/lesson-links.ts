import path from "node:path";

import type { LessonSummary } from "../lesson/lesson-types";

const EXTERNAL_SCHEME = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

function normalizeSourcePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function stripTheoryPrefix(value: string): string {
  return value.replace(/^theory\//, "");
}

function withoutFragment(value: string): { pathname: string; suffix: string } {
  const hashIndex = value.indexOf("#");
  if (hashIndex === -1) return { pathname: value, suffix: "" };
  return { pathname: value.slice(0, hashIndex), suffix: value.slice(hashIndex) };
}

/**
 * Resolves a source-relative lesson link to the app's canonical route. Links
 * that are not lesson files are deliberately left untouched so ordinary
 * Markdown links and same-page anchors keep their authored behavior.
 */
export function resolveLessonHref(
  href: string,
  sourcePath: string | undefined,
  lessons: readonly LessonSummary[] = [],
): string {
  if (!href || !sourcePath || href.startsWith("#") || EXTERNAL_SCHEME.test(href)) {
    return href;
  }

  const { pathname, suffix } = withoutFragment(href);
  if (!pathname.toLowerCase().endsWith(".mdx")) return href;

  const currentPath = normalizeSourcePath(sourcePath);
  const absoluteSource = path.posix.normalize(path.posix.join(path.posix.dirname(currentPath), pathname));
  const normalizedSource = stripTheoryPrefix(absoluteSource);

  const lesson = lessons.find((candidate) => {
    if (!candidate.sourcePath) return false;
    const candidatePath = stripTheoryPrefix(normalizeSourcePath(candidate.sourcePath));
    return candidatePath === normalizedSource;
  });

  if (!lesson) return href;
  return `/learn/${encodeURIComponent(lesson.module)}/${encodeURIComponent(lesson.slug)}${suffix}`;
}

/**
 * Rehype plugin factory used after Markdown/GFM parsing. Keeping link
 * rewriting in the AST means links created by normal Markdown syntax and
 * links inside reference lists receive the same treatment.
 */
export function rehypeLessonLinks(
  sourcePathOrOptions:
    | string
    | undefined
    | { sourcePath?: string; lessons?: readonly LessonSummary[] } = undefined,
  lessonRecords: readonly LessonSummary[] = [],
) {
  const sourcePath =
    typeof sourcePathOrOptions === "object" && sourcePathOrOptions !== null
      ? sourcePathOrOptions.sourcePath
      : sourcePathOrOptions;
  const lessons =
    typeof sourcePathOrOptions === "object" && sourcePathOrOptions !== null
      ? sourcePathOrOptions.lessons ?? []
      : lessonRecords;
  return (tree: unknown) => {
    visitElements(tree, (node) => {
      const properties = node.properties;
      if (!properties || typeof properties.href !== "string") return;
      properties.href = resolveLessonHref(properties.href, sourcePath, lessons);
    });
  };
}

type ElementNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: unknown[];
};

function visitElements(tree: unknown, visitor: (node: ElementNode) => void): void {
  if (!tree || typeof tree !== "object") return;
  const node = tree as ElementNode;
  if (node.type === "element") visitor(node);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) visitElements(child, visitor);
}

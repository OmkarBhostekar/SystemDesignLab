import fs from "node:fs";
import path from "node:path";

import {
  ContentIssue,
  ContentWarning,
  LocalSourceLink,
  SourceLinkResolution,
} from "./types";
import { slugifyHeading } from "./frontmatter";

type LinkCheckInput = {
  body: string;
  sourceAbsolutePath: string;
  projectRoot: string;
  theoryRoot: string;
  sourcePath: string;
  knownSourcePaths: Set<string>;
  knownLessons: Map<string, { sourcePath?: string; projectRelativePath?: string; parsed?: { data: { id: string; module: string; slug: string } } }>;
  knownHeadings: Map<string, Set<string>>;
};

export type LinkValidationResult = {
  links: LocalSourceLink[];
  errors: ContentIssue[];
  warnings: ContentWarning[];
};

type ExtractedLink = {
  href: string;
  label: string;
  isImage: boolean;
};

/** Validate all Markdown/MDX source links, including local assets and anchors. */
export function validateSourceLinks(input: LinkCheckInput): LinkValidationResult {
  const errors: ContentIssue[] = [];
  const warnings: ContentWarning[] = [];
  const links: LocalSourceLink[] = [];
  const headings = headingSlugs(input.body);
  const seenLocal = new Set<string>();

  for (const extracted of extractMarkdownLinks(input.body)) {
    const href = decodeHref(extracted.href);
    if (href.length === 0) {
      errors.push({
        path: input.sourcePath,
        field: "links",
        code: "broken-local-link",
        message: "empty Markdown link destination",
      });
      continue;
    }

    const externalProtocol = protocolOf(href);
    if (externalProtocol) {
      if (!isAllowedExternalUrl(href)) {
        errors.push({
          path: input.sourcePath,
          field: "links",
          code: "malformed-external-link",
          message: `unsupported or malformed external URL ${JSON.stringify(href)}; use an https URL`,
        });
      }
      continue;
    }

    if (href.startsWith("//")) {
      errors.push({
        path: input.sourcePath,
        field: "links",
        code: "malformed-external-link",
        message: `protocol-relative URL ${JSON.stringify(href)} is not allowed; use an explicit https:// URL`,
      });
      continue;
    }

    const [destination, fragment] = splitFragment(href);
    if (destination === "") {
      const normalizedFragment = normalizeFragment(fragment);
      if (!normalizedFragment) {
        errors.push({
          path: input.sourcePath,
          field: "links",
          code: "broken-local-link",
          message: `empty anchor in ${JSON.stringify(href)}`,
        });
        continue;
      }
      if (!headings.has(normalizedFragment)) {
        errors.push({
          path: input.sourcePath,
          field: "links",
          code: "broken-local-link",
          message: `anchor ${JSON.stringify(fragment)} does not match a heading in this lesson`,
        });
        continue;
      }
      links.push({
        href: extracted.href,
        label: extracted.label,
        isImage: extracted.isImage,
        sourcePath: input.sourcePath,
        fragment: normalizedFragment,
        kind: "lesson",
        route: `${routeForSource(input, input.sourcePath)}#${normalizedFragment}`,
      });
      continue;
    }

    if (destination.startsWith("/")) {
      errors.push({
        path: input.sourcePath,
        field: "links",
        code: "broken-local-link",
        message: `absolute local path ${JSON.stringify(destination)} is not portable; use a relative source link`,
      });
      continue;
    }

    const absoluteTarget = path.resolve(path.dirname(input.sourceAbsolutePath), destination);
    if (!isWithin(input.projectRoot, absoluteTarget)) {
      errors.push({
        path: input.sourcePath,
        field: "links",
        code: "broken-local-link",
        message: `local link ${JSON.stringify(extracted.href)} escapes the project root`,
      });
      continue;
    }

    const targetSourcePath = normalizeProjectPath(path.relative(input.projectRoot, absoluteTarget));
    const isLesson = destination.toLowerCase().endsWith(".mdx");
    if (!fs.existsSync(absoluteTarget)) {
      errors.push({
        path: input.sourcePath,
        field: "links",
        code: "broken-local-link",
        message: `local ${isLesson ? "lesson" : "asset/file"} link ${JSON.stringify(extracted.href)} does not resolve to ${targetSourcePath}`,
      });
      continue;
    }

    if (isLesson && !input.knownSourcePaths.has(targetSourcePath)) {
      errors.push({
        path: input.sourcePath,
        field: "links",
        code: "broken-local-link",
        message: `lesson link ${JSON.stringify(extracted.href)} points to a file that is not indexed`,
      });
      continue;
    }

    const targetLesson = isLesson ? findLessonBySourcePath(targetSourcePath, input.knownLessons) : undefined;
    const normalizedFragment = fragment ? normalizeFragment(fragment) : undefined;
    if (fragment && !normalizedFragment) {
      errors.push({
        path: input.sourcePath,
        field: "links",
        code: "broken-local-link",
        message: `empty anchor in ${JSON.stringify(extracted.href)}`,
      });
      continue;
    }
    if (normalizedFragment && isLesson) {
      const targetHeadings = input.knownHeadings.get(targetSourcePath);
      if (targetHeadings && !targetHeadings.has(normalizedFragment)) {
        errors.push({
          path: input.sourcePath,
          field: "links",
          code: "broken-local-link",
          message: `anchor ${JSON.stringify(fragment)} does not match a heading in linked lesson ${JSON.stringify(targetSourcePath)}`,
        });
        continue;
      }
    }

    const key = `${targetSourcePath}#${normalizedFragment ?? ""}`;
    if (!seenLocal.has(key)) seenLocal.add(key);
    links.push({
      href: extracted.href,
      label: extracted.label,
      isImage: extracted.isImage,
      sourcePath: targetSourcePath,
      fragment: normalizedFragment,
      kind: targetLesson ? "lesson" : isLesson ? "lesson" : "asset",
      ...(targetLesson
        ? {
            lessonId: targetLesson.id,
            route: `/learn/${targetLesson.module}/${targetLesson.slug}${normalizedFragment ? `#${normalizedFragment}` : ""}`,
          }
        : {}),
    });
  }

  return { links, errors, warnings };
}

/** Extract Markdown links and image links without treating code URLs as links. */
export function extractMarkdownLinks(body: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const source = stripFencedCode(body);
  const pattern = /(!?)\[([^\]]*)\]\(\s*(<[^>]*>|[^\s)]*(?:\([^\s)]*\)[^\s)]*)?)\s*(?:["'][^"']*["'])?\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const rawDestination = match[3].startsWith("<") && match[3].endsWith(">")
      ? match[3].slice(1, -1)
      : match[3];
    links.push({ href: rawDestination, label: match[2], isImage: match[1] === "!" });
  }

  // MDX/HTML image and anchor attributes are also local links. Ignore other
  // JSX attributes: component props are not source links.
  const htmlAttributePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/g;
  while ((match = htmlAttributePattern.exec(source))) {
    const href = match[2];
    if (links.some((link) => link.href === href)) continue;
    links.push({ href, label: "", isImage: /\bsrc\s*=/.test(match[0]) });
  }
  return links;
}

function stripFencedCode(body: string): string {
  const lines = body.split(/\r?\n/);
  let inFence = false;
  const output: string[] = [];
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      output.push("");
      continue;
    }
    output.push(inFence ? "" : line);
  }
  return output.join("\n");
}

function protocolOf(href: string): string | undefined {
  const match = href.match(/^([a-z][a-z0-9+.-]*):/i);
  return match?.[1].toLowerCase();
}

function isAllowedExternalUrl(href: string): boolean {
  const protocol = protocolOf(href);
  if (protocol !== "https" && protocol !== "http") return false;
  try {
    const parsed = new URL(href);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function splitFragment(href: string): [string, string | undefined] {
  const hashIndex = href.indexOf("#");
  return hashIndex < 0 ? [href, undefined] : [href.slice(0, hashIndex), href.slice(hashIndex + 1)];
}

function normalizeFragment(fragment: string | undefined): string | undefined {
  if (fragment === undefined) return undefined;
  const decoded = decodeHref(fragment).replace(/^#/, "").trim();
  return slugifyHeading(decoded);
}

function decodeHref(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

function headingSlugs(body: string): Set<string> {
  const slugs = new Set<string>();
  const counts = new Map<string, number>();
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = slugifyHeading(match[1].replace(/\[[^\]]*\]\([^)]*\)/g, "$1"));
    if (!base) continue;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

function normalizeProjectPath(value: string): string {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function routeForSource(input: LinkCheckInput, sourcePath: string): string {
  const target = findLessonBySourcePath(sourcePath, input.knownLessons);
  return target ? `/learn/${target.module}/${target.slug}` : `/learn/${sourcePath}`;
}

function findLessonBySourcePath(
  sourcePath: string,
  knownLessons: Map<string, { sourcePath?: string; projectRelativePath?: string; parsed?: { data: { id: string; module: string; slug: string } } }>,
): { id: string; module: string; slug: string } | undefined {
  // The pipeline's relationship map is ID-keyed, so source lookup needs to be
  // represented by a temporary source key when available. In production we
  // populate this through `findLessonBySourcePath`'s fallback below.
  for (const owner of knownLessons.values()) {
    const ownerPath = owner.sourcePath ?? owner.projectRelativePath;
    if (owner.parsed?.data && ownerPath && normalizeProjectPath(ownerPath) === normalizeProjectPath(sourcePath)) {
      return owner.parsed.data;
    }
  }
  return undefined;
}

/**
 * Resolve a source link to an app route when it targets an indexed lesson.
 * External URLs and local assets are returned unchanged.
 */
export function mapLocalSourceLinkToRoute(
  href: string,
  sourcePath: string,
  knownLessons: Iterable<{ id: string; sourcePath: string; module: string; slug: string }>,
): SourceLinkResolution {
  const protocol = protocolOf(href);
  if (protocol) return { kind: "external", href };
  if (href.startsWith("#")) {
    const fragment = normalizeFragment(href.slice(1)) ?? "";
    return {
      kind: "anchor",
      href,
      fragment,
      route: `${routeForLessonSource(sourcePath, knownLessons)}#${fragment}`,
    };
  }
  const [destination, rawFragment] = splitFragment(href);
  const targetPath = normalizeProjectPath(path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), destination)));
  const target = [...knownLessons].find((lesson) => normalizeProjectPath(lesson.sourcePath) === targetPath);
  if (target) {
    const fragment = rawFragment ? normalizeFragment(rawFragment) : undefined;
    return {
      kind: "lesson",
      href,
      fragment,
      lessonId: target.id,
      route: `/learn/${target.module}/${target.slug}${fragment ? `#${fragment}` : ""}`,
    };
  }
  return { kind: "local", href, fragment: rawFragment ? normalizeFragment(rawFragment) : undefined, sourcePath: targetPath };
}

function routeForLessonSource(
  sourcePath: string,
  knownLessons: Iterable<{ id: string; sourcePath: string; module: string; slug: string }>,
): string {
  const target = [...knownLessons].find((lesson) => normalizeProjectPath(lesson.sourcePath) === normalizeProjectPath(sourcePath));
  return target ? `/learn/${target.module}/${target.slug}` : `/learn/${sourcePath}`;
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ContentValidationError,
  getNextLesson,
  getPreviousLesson,
  loadContentIndex,
  loadLessonSource,
  mapLocalSourceLinkToRoute,
  resolveLesson,
  resolveModule,
  validateContent,
} from "@/content";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function fixtureRoot(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "system-design-content-"));
  temporaryRoots.push(root);
  for (const [relativePath, source] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, source, "utf8");
  }
  return root;
}

function lesson(overrides: Record<string, string> = {}, body = "# Lesson\n\nBody."): string {
  const values: Record<string, string> = {
    type: "lesson",
    id: "00-01-first",
    slug: "first",
    title: "First Lesson",
    description: "A concise lesson description.",
    module: "interview-method",
    order: "1",
    difficulty: "core",
    estimatedMinutes: "20",
    prerequisites: "[]",
    tags: "[systems]",
    objectives: "[Understand the model, Explain the trade-off]",
    relatedLessons: "[]",
    ...overrides,
  };
  return `---\n${Object.entries(values).map(([key, value]) => `${key}: ${value}`).join("\n")}\n---\n${body}`;
}

function expectValidationFailure(root: string, field: string, code?: string): ContentValidationError {
  expect(() => loadContentIndex({ projectRoot: root })).toThrow(ContentValidationError);
  const result = validateContent({ projectRoot: root });
  expect(result.ok).toBe(false);
  expect(result.errors.some((error) => error.field.includes(field))).toBe(true);
  if (code) expect(result.errors.some((error) => error.code === code)).toBe(true);
  return new ContentValidationError(result.errors);
}

describe("the production content index", () => {
  it("validates all four completed modules and 29 lessons", () => {
    const index = loadContentIndex();
    expect(index.lessons).toHaveLength(29);
    expect(index.modules.map((module) => module.id)).toEqual([
      "interview-method",
      "foundations",
      "networking",
      "traffic-and-services",
    ]);
    expect(index.modules.map((module) => module.lessons.length)).toEqual([4, 10, 7, 8]);
    expect(index.lessons.every((lesson) => !Object.prototype.hasOwnProperty.call(lesson, "body"))).toBe(true);
  });

  it("resolves routes and previous/next navigation without scanning prose", () => {
    const index = loadContentIndex();
    const first = resolveLesson(index, "00-01-interview-signals");
    const firstByRoute = resolveLesson(index, "interview-method", "interview-signals");
    expect(first).toBe(firstByRoute);
    expect(first?.route).toBe("/learn/interview-method/interview-signals");
    expect(getPreviousLesson(index, first!)).toBeUndefined();
    expect(getNextLesson(index, first!)?.id).toBe("00-02-requirements");
    expect(resolveModule(index, "foundations")?.lessons[0].id).toBe("01-01-performance-vs-scalability");
  });

  it("loads the source body on demand and maps local lesson links to routes", () => {
    const index = loadContentIndex();
    const lessonRecord = resolveLesson(index, "00-02-requirements")!;
    const source = loadLessonSource(lessonRecord);
    expect(source.sourcePath).toBe(lessonRecord.sourcePath);
    expect(source.body).toContain("# Functional and Non-Functional Requirements");
    const mapped = mapLocalSourceLinkToRoute(
      "./requirements.mdx",
      lessonRecord.sourcePath,
      index.lessons,
    );
    expect(mapped).toMatchObject({ kind: "lesson", lessonId: lessonRecord.id, route: lessonRecord.route });
  });
});

describe("frontmatter and metadata validation", () => {
  it("rejects malformed YAML with a lesson path and frontmatter field", () => {
    const root = fixtureRoot({ "theory/00-interview-method/bad.mdx": "---\norder: [\n---\n# Bad" });
    const result = validateContent({ projectRoot: root });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({ field: "frontmatter", code: "frontmatter-malformed" });
    expect(result.errors[0].path).toContain("theory/00-interview-method/bad.mdx");
  });

  it("rejects missing, invalid, unknown, and duplicate metadata values", () => {
    const root = fixtureRoot({
      "theory/00-interview-method/bad.mdx": lesson({
        id: "Not Valid",
        order: "0",
        tags: "[systems, systems]",
        unknownField: "oops",
      }),
    });
    const result = validateContent({ projectRoot: root });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.field === "id")).toBe(true);
    expect(result.errors.some((error) => error.field === "order")).toBe(true);
    expect(result.errors.some((error) => error.field.includes("unknownField"))).toBe(true);
  });

  it("rejects duplicate IDs, module/slugs, and module orders", () => {
    const root = fixtureRoot({
      "theory/00-interview-method/first.mdx": lesson(),
      "theory/00-interview-method/second.mdx": lesson({ id: "00-01-first-too", slug: "first" }),
      "theory/00-interview-method/third.mdx": lesson({ id: "00-01-first", slug: "third" }),
    });
    const result = validateContent({ projectRoot: root });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "duplicate-id")).toBe(true);
    expect(result.errors.some((error) => error.code === "duplicate-slug")).toBe(true);
    expect(result.errors.some((error) => error.code === "duplicate-order")).toBe(true);
  });

  it("rejects module/path mismatch", () => {
    const root = fixtureRoot({
      "theory/01-foundations/first.mdx": lesson({ module: "networking" }),
    });
    expectValidationFailure(root, "module", "path-module-mismatch");
  });
});

describe("relationship and local-link validation", () => {
  it("rejects unresolved prerequisites and related lesson IDs", () => {
    const root = fixtureRoot({
      "theory/00-interview-method/first.mdx": lesson({
        prerequisites: "[00-99-missing]",
        relatedLessons: "[00-98-missing]",
      }),
    });
    const result = validateContent({ projectRoot: root });
    expect(result.ok).toBe(false);
    expect(result.errors.filter((error) => error.code === "unresolved-reference")).toHaveLength(2);
  });

  it("rejects prerequisite self-references and cycles", () => {
    const root = fixtureRoot({
      "theory/00-interview-method/first.mdx": lesson({
        prerequisites: "[00-02-second]",
      }),
      "theory/00-interview-method/second.mdx": lesson({
        id: "00-02-second",
        slug: "second",
        order: "2",
        prerequisites: "[00-01-first]",
      }),
    });
    const result = validateContent({ projectRoot: root });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "dependency-cycle")).toBe(true);

    const selfRoot = fixtureRoot({
      "theory/00-interview-method/self.mdx": lesson({ prerequisites: "[00-01-first]" }),
    });
    expectValidationFailure(selfRoot, "prerequisites[0]", "self-reference");
  });

  it("rejects broken lesson links, anchors, and assets while accepting a real asset", () => {
    const root = fixtureRoot({
      "theory/00-interview-method/first.mdx": lesson({}, [
        "# Lesson",
        "",
        "## Details",
        "",
        "[missing](./missing.mdx)",
        "[missing-anchor](#no-such-heading)",
        "![missing-asset](./missing.png)",
        "![valid-asset](./diagram.svg)",
      ].join("\n")),
      "theory/00-interview-method/diagram.svg": "<svg />",
    });
    const result = validateContent({ projectRoot: root });
    expect(result.ok).toBe(false);
    expect(result.errors.filter((error) => error.code === "broken-local-link")).toHaveLength(3);
  });
});

describe("determinism and registry phase behavior", () => {
  it("produces deterministic lesson/module ordering and JSON", () => {
    const root = fixtureRoot({
      "theory/01-foundations/z.mdx": lesson({ module: "foundations", id: "01-02-z", slug: "z", order: "2" }),
      "theory/01-foundations/a.mdx": lesson({ module: "foundations", id: "01-01-a", slug: "a", order: "1" }),
    });
    const first = loadContentIndex({ projectRoot: root });
    const second = loadContentIndex({ projectRoot: root });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.lessons.map((lesson) => lesson.id)).toEqual(["01-01-a", "01-02-z"]);
  });

  it("does not require visualization or quiz registries during theory-only indexing", () => {
    const root = fixtureRoot({
      "theory/00-interview-method/first.mdx": lesson({ visualizationId: "future-viz", quizId: "future-quiz" }),
    });
    expect(loadContentIndex({ projectRoot: root }).lessons[0]).toMatchObject({
      visualizationId: "future-viz",
      quizId: "future-quiz",
    });
    const result = validateContent({ projectRoot: root, visualizationIds: [], quizIds: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "unregistered-visualization")).toBe(true);
    expect(result.errors.some((error) => error.code === "unregistered-quiz")).toBe(true);
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { deriveHeadingSlugs, slugifyHeading } from "@/content";

const projectRoot = process.cwd();

function markdownDocuments(): string[] {
  const files = ["CODEX.md", "README.md"];
  for (const root of ["docs", "theory"]) {
    walk(path.join(projectRoot, root), files);
  }
  return files
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.resolve(projectRoot, file))
    .sort((left, right) => left.localeCompare(right));
}

function walk(directory: string, files: string[]): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath, files);
    else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.relative(projectRoot, absolutePath));
    }
  }
}

function withoutFencedCode(source: string): string {
  let fence: "```" | "~~~" | undefined;
  return source
    .split(/\r?\n/)
    .map((line) => {
      const marker = line.match(/^\s*(```|~~~)/)?.[1] as "```" | "~~~" | undefined;
      if (marker && (!fence || fence === marker)) {
        fence = fence ? undefined : marker;
        return "";
      }
      return fence ? "" : line;
    })
    .join("\n");
}

function localLinks(source: string): string[] {
  const links: string[] = [];
  const pattern = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^\s)]*(?:\([^\s)]*\)[^\s)]*)?)\s*(?:["'][^"']*["'])?\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutFencedCode(source)))) {
    const href = match[1].startsWith("<") ? match[1].slice(1, -1) : match[1];
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith("//")) links.push(href);
  }
  return links;
}

function headingExists(filePath: string, fragment: string): boolean {
  const normalized = slugifyHeading(decodeURIComponent(fragment));
  if (!normalized) return false;
  return deriveHeadingSlugs(fs.readFileSync(filePath, "utf8")).includes(normalized);
}

describe("Markdown documentation links", () => {
  it("resolves local files and heading anchors outside fenced examples", () => {
    const failures: string[] = [];

    for (const documentPath of markdownDocuments()) {
      const source = fs.readFileSync(documentPath, "utf8");
      for (const href of localLinks(source)) {
        const [rawTarget, fragment] = href.split("#", 2);
        const targetPath = rawTarget
          ? path.resolve(path.dirname(documentPath), decodeURIComponent(rawTarget))
          : documentPath;
        const label = `${path.relative(projectRoot, documentPath)} -> ${href}`;
        if (!fs.existsSync(targetPath)) {
          failures.push(`${label} (missing target)`);
        } else if (fragment && fs.statSync(targetPath).isFile() && !headingExists(targetPath, fragment)) {
          failures.push(`${label} (missing heading)`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

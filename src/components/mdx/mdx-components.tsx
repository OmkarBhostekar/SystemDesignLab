import { isValidElement, type ComponentProps, type ReactNode } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "./MermaidDiagram";
import { rehypeLessonLinks } from "./lesson-links";
import type { MdxRendererProps } from "../lesson/lesson-types";

type AnchorProps = ComponentProps<"a">;

function isExternalHttpLink(href: string | undefined): boolean {
  return Boolean(href && /^https?:\/\//i.test(href));
}

function ExternalAwareLink({ href, children, ...props }: AnchorProps) {
  const external = isExternalHttpLink(href);
  return (
    <a
      href={href}
      {...props}
      className={[props.className, external ? "mdx-external-link" : undefined].filter(Boolean).join(" ") || undefined}
      data-external={external ? "true" : undefined}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : undefined)}
    >
      {children}
      {external ? <span aria-hidden="true"> ↗</span> : null}
    </a>
  );
}

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textFromChildren).join("");
  if (children === null || children === undefined || typeof children === "boolean") return "";
  if (isValidElement(children)) {
    const elementChildren = (children.props as { children?: ReactNode }).children;
    return textFromChildren(elementChildren);
  }
  return String(children);
}

function Code({ className, children, ...props }: ComponentProps<"code">) {
  const dataLanguage = (props as Record<string, unknown>)["data-language"];
  const language = className?.match(/language-([\w-]+)/)?.[1] ??
    (typeof dataLanguage === "string" ? dataLanguage : undefined);
  const code = textFromChildren(children).replace(/\n$/, "");

  if (language === "mermaid") {
    return <MermaidDiagram chart={code} />;
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

function Pre({ children, ...props }: ComponentProps<"pre">) {
  const dataLanguage = (props as Record<string, unknown>)["data-language"];
  const codeLanguage = isValidElement(children)
    ? (children.props as Record<string, unknown>)["data-language"]
    : undefined;
  const language =
    (typeof dataLanguage === "string" ? dataLanguage : undefined) ??
    (typeof codeLanguage === "string" ? codeLanguage : undefined);

  if (language === "mermaid") {
    return <MermaidDiagram chart={textFromChildren(children).replace(/\n$/, "")} />;
  }

  return <pre {...props}>{children}</pre>;
}

function Figure({ children, ...props }: ComponentProps<"figure">) {
  const isPrettyCodeFigure = "data-rehype-pretty-code-figure" in props;
  if (isPrettyCodeFigure && isValidElement(children)) {
    const childProps = children.props as Record<string, unknown>;
    const language = childProps["data-language"];
    if (language === "mermaid") {
      return <MermaidDiagram chart={textFromChildren(childProps.children as ReactNode).replace(/\n$/, "")} />;
    }
    if (children.type === MermaidDiagram) return children;
  }
  return <figure {...props}>{children}</figure>;
}

function MdxImage({ alt, src, ...props }: ComponentProps<"img">) {
  // Lesson content is authored in-repository. Keep the native element so
  // relative assets work without introducing a broad client/image boundary.
  // eslint-disable-next-line @next/next/no-img-element -- lesson-local assets may be relative to their source file.
  return <img src={src} alt={alt ?? ""} loading="lazy" {...props} />;
}

const components = {
  a: ExternalAwareLink,
  code: Code,
  figure: Figure,
  pre: Pre,
  img: MdxImage,
  MermaidDiagram,
  h1: (props: ComponentProps<"h1">) => <h1 className="mdx-heading mdx-heading--1" {...props} />,
  h2: (props: ComponentProps<"h2">) => <h2 className="mdx-heading mdx-heading--2" {...props} />,
  h3: (props: ComponentProps<"h3">) => <h3 className="mdx-heading mdx-heading--3" {...props} />,
  table: (props: ComponentProps<"table">) => (
    <div className="mdx-table-wrap">
      <table {...props} />
    </div>
  ),
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote className="mdx-blockquote" {...props} />
  ),
};

export type { MdxRendererProps };

/**
 * Server-rendered Markdown-compatible MDX. JavaScript expressions and MDX
 * imports are blocked; only the explicitly mapped presentation components are
 * available to authored content.
 */
export async function MdxContent({ source, title, sourcePath, lessons = [], className }: MdxRendererProps) {
  const renderSource = stripDuplicateLeadingTitle(source, title);
  return (
    <div className={["mdx-content", className].filter(Boolean).join(" ")}>
      <MDXRemote
        source={renderSource}
        components={components}
        options={{
          blockJS: true,
          blockDangerousJS: true,
          parseFrontmatter: false,
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              rehypeSlug,
              [rehypeLessonLinks, { sourcePath, lessons }],
              [rehypePrettyCode, { theme: { light: "github-light", dark: "github-dark" } }],
            ],
          },
        }}
      />
    </div>
  );
}

/** Keep repository Markdown complete while avoiding two visible page titles. */
function stripDuplicateLeadingTitle(source: string, title?: string): string {
  if (!title) return source;
  const match = source.match(/^(?:\uFEFF)?\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  if (!match) return source;
  const authoredTitle = match[1].replace(/[`*_~]/g, "").trim();
  if (authoredTitle.toLocaleLowerCase() !== title.trim().toLocaleLowerCase()) return source;
  return source.slice(match[0].length);
}

export { components as mdxComponents };
export { MermaidDiagram } from "./MermaidDiagram";
export { resolveLessonHref, rehypeLessonLinks } from "./lesson-links";

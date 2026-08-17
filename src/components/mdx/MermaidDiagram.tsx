"use client";

import { useEffect, useId, useState } from "react";

type MermaidDiagramProps = {
  chart: string;
  title?: string;
};

/**
 * A deliberately narrow client boundary for authored Mermaid diagrams. The
 * source comes from repository-owned MDX, Mermaid runs in strict mode, and a
 * readable source fallback remains visible when rendering is unavailable.
 */
export function MermaidDiagram({ chart, title = "Diagram" }: MermaidDiagramProps) {
  const reactId = useId();
  const diagramId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });
        const result = await mermaid.render(diagramId, chart.trim());
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
          setError("This diagram could not be rendered in the current browser.");
        }
      }
    }

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [chart, diagramId]);

  return (
    <figure className="mdx-mermaid" aria-label={title}>
      <div className="mdx-mermaid__visual" role="img" aria-label={title}>
        {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      </div>
      {error || !svg ? (
        <details className="mdx-mermaid__source" open={!svg}>
          <summary>{error ? "Show diagram source" : "Diagram source"}</summary>
          <pre>
            <code>{chart.trim()}</code>
          </pre>
        </details>
      ) : null}
      <figcaption>{title}</figcaption>
    </figure>
  );
}

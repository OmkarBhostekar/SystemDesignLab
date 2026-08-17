import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TheoryOnlyState } from "@/components/lesson/TheoryOnlyState";

describe("theory-only lesson state", () => {
  it("keeps authored theory available when enhancements are absent", () => {
    const markup = renderToStaticMarkup(
      <TheoryOnlyState visualizationId={null} quizId={null} />,
    );
    expect(markup).toContain("Visualization coming later");
    expect(markup).toContain("Structured quiz coming later");
    expect(markup).toContain("authored theory remains complete");
  });

  it("does not show an unavailable card for a registered enhancement", () => {
    const markup = renderToStaticMarkup(
      <TheoryOnlyState visualizationId="hash-ring" visualizationAvailable />,
    );
    expect(markup).not.toContain("Visualization coming later");
    expect(markup).toContain("Structured quiz coming later");
  });
});

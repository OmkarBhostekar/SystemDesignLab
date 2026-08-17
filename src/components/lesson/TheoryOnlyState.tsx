type TheoryOnlyStateProps = {
  visualizationId?: string | null;
  quizId?: string | null;
  visualizationAvailable?: boolean;
  quizAvailable?: boolean;
};

function UnavailableCard({
  kind,
  id,
  available,
}: {
  kind: "visualization" | "quiz";
  id?: string | null;
  available: boolean;
}) {
  if (available) return null;

  const hasPlannedRegistration = Boolean(id);
  const label = kind === "visualization" ? "Visualization" : "Structured quiz";
  const description = hasPlannedRegistration
    ? `${label} “${id}” is referenced by this lesson but is not available in this reader build yet.`
    : `${label} content has not been registered for this lesson yet.`;

  return (
    <aside className="theory-only-state" role="note" aria-label={`${label} unavailable`}>
      <strong>{label} coming later</strong>
      <p>{description} The authored theory remains complete and available below.</p>
    </aside>
  );
}

export function TheoryOnlyState({
  visualizationId,
  quizId,
  visualizationAvailable = false,
  quizAvailable = false,
}: TheoryOnlyStateProps) {
  if (visualizationAvailable && quizAvailable) return null;

  return (
    <section className="theory-only-states" aria-label="Lesson availability">
      <UnavailableCard
        kind="visualization"
        id={visualizationId}
        available={visualizationAvailable}
      />
      <UnavailableCard kind="quiz" id={quizId} available={quizAvailable} />
    </section>
  );
}

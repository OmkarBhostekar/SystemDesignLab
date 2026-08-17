import type { LessonSummary } from "./lesson-types";

const difficultyLabels: Record<LessonSummary["difficulty"], string> = {
  core: "Core",
  advanced: "Advanced",
  "deep-dive": "Deep dive",
};

type LessonMetadataProps = {
  lesson: LessonSummary;
};

export function LessonMetadata({ lesson }: LessonMetadataProps) {
  return (
    <dl className="lesson-metadata" aria-label="Lesson details">
      <div>
        <dt>Level</dt>
        <dd>{difficultyLabels[lesson.difficulty]}</dd>
      </div>
      <div>
        <dt>Study time</dt>
        <dd>{lesson.estimatedMinutes} min</dd>
      </div>
      {lesson.tags.length > 0 ? (
        <div>
          <dt>Topics</dt>
          <dd>
            <ul aria-label="Topics">
              {lesson.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

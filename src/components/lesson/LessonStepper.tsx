type LessonStepperProps = {
  visualizationAvailable: boolean;
  quizAvailable: boolean;
};

type Step = {
  label: string;
  available: boolean;
  detail: string;
};

export function LessonStepper({ visualizationAvailable, quizAvailable }: LessonStepperProps) {
  const steps: Step[] = [
    { label: "Theory", available: true, detail: "Read the authored explanation" },
    {
      label: "Visualize",
      available: visualizationAvailable,
      detail: visualizationAvailable ? "Interactive visualization" : "Planned enhancement",
    },
    {
      label: "Quiz",
      available: quizAvailable,
      detail: quizAvailable ? "Structured retrieval practice" : "Planned enhancement",
    },
    { label: "Interview lens", available: true, detail: "Apply the idea in an interview" },
  ];

  return (
    <ol className="lesson-stepper" aria-label="Lesson steps">
      {steps.map((step, index) => (
        <li key={step.label} aria-current={index === 0 ? "step" : undefined}>
          <span className="lesson-stepper__number" aria-hidden="true">
            {index + 1}
          </span>
          <span>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

type LessonStepperProps = {
  visualizationAvailable: boolean;
  quizAvailable: boolean;
};

type Step = {
  label: string;
  available: boolean;
  detail: string;
  href?: string;
};

export function LessonStepper({ visualizationAvailable, quizAvailable }: LessonStepperProps) {
  const steps: Step[] = [
    { label: "Theory", available: true, detail: "Start with the core model", href: "#theory" },
    {
      label: "Visualize",
      available: visualizationAvailable,
      detail: visualizationAvailable ? "Interactive visualization" : "Planned enhancement",
      href: visualizationAvailable ? "#visualization" : undefined,
    },
    { label: "Interview lens", available: true, detail: "Apply the idea in an interview", href: "#interview-lens" },
    {
      label: "Practice",
      available: quizAvailable,
      detail: quizAvailable ? "Structured retrieval practice" : "Planned enhancement",
      href: "#practice",
    },
  ];

  return (
    <ol className="lesson-stepper" aria-label="Lesson steps">
      {steps.map((step, index) => (
        <li key={step.label} data-available={step.available ? "true" : "false"}>
          {step.href ? <a href={step.href}>
            <span className="lesson-stepper__number" aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
          </a> : <span className="lesson-stepper__item" aria-disabled="true">
            <span className="lesson-stepper__number" aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </span>
          </span>}
        </li>
      ))}
    </ol>
  );
}

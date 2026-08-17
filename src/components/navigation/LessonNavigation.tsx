import Link from "next/link";

import type { LessonNavigationItem } from "@/components/navigation/types";

export interface LessonNavigationProps {
  previous?: LessonNavigationItem;
  next?: LessonNavigationItem;
  label?: string;
  className?: string;
}

function NavigationLink({ item, direction }: { item: LessonNavigationItem; direction: "previous" | "next" }) {
  return (
    <Link
      className={`lesson-navigation__link lesson-navigation__link--${direction}`}
      href={item.href}
      rel={direction === "previous" ? "prev" : "next"}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} lesson: ${item.title}`}
    >
      <span className="lesson-navigation__direction" aria-hidden="true">
        {direction === "previous" ? "←" : "→"} {direction === "previous" ? "Previous" : "Next"}
      </span>
      <span className="lesson-navigation__title">{item.title}</span>
      {item.moduleTitle ? <span className="lesson-navigation__module">{item.moduleTitle}</span> : null}
    </Link>
  );
}

export function LessonNavigation({ previous, next, label = "Lesson navigation", className = "" }: LessonNavigationProps) {
  return (
    <nav className={`lesson-navigation${className ? ` ${className}` : ""}`} aria-label={label}>
      <div className="lesson-navigation__item">
        {previous ? (
          <NavigationLink item={previous} direction="previous" />
        ) : (
          <span className="lesson-navigation__boundary" aria-disabled="true">
            <span className="lesson-navigation__direction">Start of module</span>
          </span>
        )}
      </div>
      <div className="lesson-navigation__item lesson-navigation__item--next">
        {next ? (
          <NavigationLink item={next} direction="next" />
        ) : (
          <span className="lesson-navigation__boundary" aria-disabled="true">
            <span className="lesson-navigation__direction">End of module</span>
          </span>
        )}
      </div>
    </nav>
  );
}

export { LessonNavigation as LessonNav };

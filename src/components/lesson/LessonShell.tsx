import type { ReactNode } from "react";

import { LessonSidebar } from "./LessonSidebar";
import type { LessonNavigationGroup, LessonSummary } from "./lesson-types";

type LessonShellProps = {
  children: ReactNode;
  groups: LessonNavigationGroup[];
  activeLessonId?: string;
  activeModule?: string;
  aside?: ReactNode;
  className?: string;
};

export function LessonShell({
  children,
  groups,
  activeLessonId,
  activeModule,
  aside,
  className,
}: LessonShellProps) {
  return (
    <div className={["lesson-shell", className].filter(Boolean).join(" ")}>
      <LessonSidebar groups={groups} activeLessonId={activeLessonId} activeModule={activeModule} />
      <main className="lesson-shell__main">{children}</main>
      {aside ? <aside className="lesson-shell__aside">{aside}</aside> : null}
    </div>
  );
}

export type { LessonNavigationGroup, LessonSummary };

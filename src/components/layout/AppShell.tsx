import type { ReactNode } from "react";

import { SiteHeader, type SiteHeaderProps } from "@/components/layout/SiteHeader";

export interface AppShellProps {
  children: ReactNode;
  header?: SiteHeaderProps;
  mainId?: string;
  mainClassName?: string;
}

/** Global chrome. Route content remains responsible for its own lesson semantics. */
export function AppShell({ children, header, mainId = "main-content", mainClassName = "" }: AppShellProps) {
  return (
    <div className="app-shell">
      <SiteHeader {...header} />
      <main id={mainId} className={`app-shell__main${mainClassName ? ` ${mainClassName}` : ""}`} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export interface ReadingFrameProps {
  children: ReactNode;
  sidebar?: ReactNode;
  rail?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}

/** Three-column reading frame; all navigation/data is supplied by the route. */
export function ReadingFrame({ sidebar, rail, breadcrumbs, children, className = "" }: ReadingFrameProps) {
  return (
    <div className={`reading-frame${sidebar ? " has-sidebar" : ""}${rail ? " has-rail" : ""}${className ? ` ${className}` : ""}`}>
      {sidebar ? <aside className="reading-frame__sidebar">{sidebar}</aside> : null}
      <div className="reading-frame__content">
        {breadcrumbs ? <div className="reading-frame__breadcrumbs">{breadcrumbs}</div> : null}
        {children}
      </div>
      {rail ? <aside className="reading-frame__rail">{rail}</aside> : null}
    </div>
  );
}

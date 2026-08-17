import Link from "next/link";

import type { BreadcrumbItem } from "@/components/navigation/types";

export interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  label?: string;
  className?: string;
}

export function Breadcrumbs({ items, label = "Breadcrumb", className = "" }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className={`breadcrumbs${className ? ` ${className}` : ""}`} aria-label={label}>
      <ol>
        {items.map((item, index) => {
          const isCurrent = item.current ?? index === items.length - 1;
          const content = item.ariaLabel ? <span aria-label={item.ariaLabel}>{item.label}</span> : item.label;

          return (
            <li key={`${item.label}-${index}`}>
              {isCurrent || !item.href ? (
                <span aria-current={isCurrent ? "page" : undefined}>{content}</span>
              ) : (
                <Link href={item.href}>{content}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumbs as LessonBreadcrumbs };

import Link from "next/link";

import type { BreadcrumbItem } from "./lesson-types";

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="lesson-breadcrumbs">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.href}-${item.label}`}>
            {item.current ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
            {index < items.length - 1 ? <span aria-hidden="true"> / </span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

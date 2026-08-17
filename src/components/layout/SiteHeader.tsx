import Link from "next/link";

import type { PrimaryNavigationItem } from "@/components/navigation/types";

const DEFAULT_NAVIGATION: readonly PrimaryNavigationItem[] = [
  { href: "/learn", label: "Learn", active: true },
];

export interface SiteHeaderProps {
  /** Keep this list supplied by the route when its active state is known. */
  navigation?: readonly PrimaryNavigationItem[];
  brandHref?: string;
  brandLabel?: string;
  searchHref?: string;
}

export function SiteHeader({
  navigation = DEFAULT_NAVIGATION,
  brandHref = "/learn",
  brandLabel = "System Design Lab",
  searchHref,
}: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-header__brand" href={brandHref} aria-label={`${brandLabel} home`}>
          <span className="site-header__mark" aria-hidden="true">
            SD
          </span>
          <span className="site-header__brand-copy">
            <span className="site-header__brand-name">{brandLabel}</span>
            <span className="site-header__brand-context">Theory reader</span>
          </span>
        </Link>

        <nav className="site-header__nav" aria-label="Primary navigation">
          <ul>
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  className={`site-header__nav-link${item.active ? " is-active" : ""}`}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {searchHref ? (
          <Link className="site-header__search" href={searchHref} aria-label="Search the curriculum">
            <span className="site-header__search-icon" aria-hidden="true">
              /
            </span>
            <span className="site-header__search-label">Search</span>
            <kbd aria-hidden="true">⌘K</kbd>
          </Link>
        ) : null}
      </div>
    </header>
  );
}

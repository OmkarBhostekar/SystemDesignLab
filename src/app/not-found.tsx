import Link from "next/link";

export default function NotFound() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <p className="eyebrow">404 · Route not found</p>
      <h1 id="not-found-title">That page is not in the curriculum.</h1>
      <p>
        The lesson or route may have moved. Start from the curriculum and follow the dependency path from there.
      </p>
      <div className="not-found__actions">
        <Link className="button button--primary" href="/learn">
          Browse the curriculum
        </Link>
      </div>
    </section>
  );
}

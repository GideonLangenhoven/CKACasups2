import Link from "next/link";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="stack" style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <header className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2>Guide</h2>
        <nav className="row" style={{ gap: 8 }}>
          <Link className="btn ghost" href="/guide">Home</Link>
          <Link className="btn ghost" href="/guide/cashups/new">New cash up</Link>
          <Link className="btn ghost" href="/trips">My trips</Link>
          <Link className="btn ghost" href="/earnings">Earnings</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}

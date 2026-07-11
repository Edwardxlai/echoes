import Link from "next/link";

export function MapTopbar({
  backHref,
  backLabel,
  status,
}: {
  backHref?: string;
  backLabel?: string;
  status: string;
}) {
  return (
    <nav className="mapTopbar" aria-label="地图导航">
      <Link className="mapIdentity" href="/" aria-label="回响世界地图首页">
        <span className="mapIdentity__sigil" aria-hidden="true">
          <span />
        </span>
        <span className="mapIdentity__name">回响</span>
        <span className="mapIdentity__edition">ECHOES / 2026</span>
      </Link>

      {backHref ? (
        <Link className="mapBacklink" href={backHref}>
          <span aria-hidden="true">←</span>
          {backLabel}
        </Link>
      ) : (
        <span className="mapTopbar__line" aria-hidden="true" />
      )}

      <div className="mapTopbar__status">
        <span className="mapTopbar__pulse" aria-hidden="true" />
        {status}
      </div>
    </nav>
  );
}

export function MapKicker({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="mapKicker">
      <span>{index}</span>
      <i aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function MapStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="mapStat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

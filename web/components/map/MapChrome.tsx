import Link from "next/link";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

export function MapReturnControl({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link className="regionReturn" href={href} aria-label={`返回${label}`}>
      <span className="regionReturn__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M10.5 5.5 4 12l6.5 6.5M4.5 12H20" />
        </svg>
      </span>
      <span className="regionReturn__copy">
        <small>返回上一级</small>
        <strong>{label}</strong>
      </span>
    </Link>
  );
}

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
      <BrandHomeLink className="mapTopbar__brand" showEdition />

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

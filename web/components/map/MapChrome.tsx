import Link from "next/link";
import { BrandHomeLink } from "@/components/brand/BrandHomeLink";

/** 区域/群岛地图左上导航组：品牌标（回世界页）+ 分隔线 + 返回上一级。 */
export function MapAtlasNav({ href, label }: { href: string; label: string }) {
  return (
    <div className="atlasNav">
      <BrandHomeLink className="atlasNav__brand" />
      <span className="atlasNav__divider" aria-hidden="true" />
      <MapReturnControl href={href} label={label} />
    </div>
  );
}

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

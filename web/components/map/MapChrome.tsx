import { BrandHomeLink } from "@/components/brand/BrandHomeLink";
import { BackLink } from "@/components/nav/BackLink";

/** 区域/群岛地图左上导航组：品牌标（回世界页）+ 分隔线 + 返回上一页。
 *  文字不点名具体目的地——群岛/区域能从很多地方进入，写死的目的地名字和真实返回页对不上。 */
export function MapAtlasNav({ href }: { href: string }) {
  return (
    <div className="atlasNav">
      <BrandHomeLink className="atlasNav__brand" />
      <span className="atlasNav__divider" aria-hidden="true" />
      <MapReturnControl href={href} />
    </div>
  );
}

export function MapReturnControl({ href }: { href: string }) {
  return (
    <BackLink className="regionReturn" href={href} ariaLabel="返回上一页">
      <span className="regionReturn__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M10.5 5.5 4 12l6.5 6.5M4.5 12H20" />
        </svg>
      </span>
      <span className="regionReturn__copy">
        <small>返回</small>
        <strong>上一页</strong>
      </span>
    </BackLink>
  );
}

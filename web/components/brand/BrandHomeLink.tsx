import Image from "next/image";
import Link from "next/link";

export function BrandHomeLink({
  className = "",
  showEdition = false,
}: {
  className?: string;
  showEdition?: boolean;
}) {
  const classes = ["brandHomeLink", className].filter(Boolean).join(" ");

  return (
    <Link className={classes} href="/" aria-label="知音，返回世界区域">
      <span className="brandHomeLink__mark" aria-hidden="true">
        <Image
          src="/brand/zhiyin-mark.svg"
          alt=""
          width={100}
          height={52}
          preload
          draggable={false}
        />
      </span>
      <span className="brandHomeLink__name">知音</span>
      {showEdition && <span className="brandHomeLink__edition">ZHIYIN / 2026</span>}
    </Link>
  );
}

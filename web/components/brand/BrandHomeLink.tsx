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
    <Link className={classes} href="/" aria-label="回响，返回世界区域">
      <span className="brandHomeLink__mark" aria-hidden="true">
        <Image
          src="/brand/echoes-mark.png"
          alt=""
          width={40}
          height={40}
          preload
          draggable={false}
        />
      </span>
      <span className="brandHomeLink__name">回响</span>
      {showEdition && <span className="brandHomeLink__edition">ECHOES / 2026</span>}
    </Link>
  );
}

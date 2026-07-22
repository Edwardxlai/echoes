"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/* 真正的「返回上一页」：有浏览器历史就往回走，没有历史（比如直接粘贴链接打开）才落回 href 兜底。
   之前这里是死链接，合集能从很多地方进入，但返回键永远回同一个写死的上级页。 */
export function BackLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(href);
    }
  };

  return (
    <a href={href} className={className} aria-label={ariaLabel} onClick={handleClick}>
      {children}
    </a>
  );
}

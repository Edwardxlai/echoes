export function fmtAgo(hours: number): string {
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${Math.floor(hours)} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 个月前`;
}


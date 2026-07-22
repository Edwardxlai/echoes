/* 互动热度：借用评论热度图（CommentHeatmap）的黑竖条语言，不是另起一套。
   values 接的是各集评论数（engagementHeatOf）——以评论量作为互动热度指数。 */
export function CollectionHeat({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="heat">
      <div className="heat__row">
        {values.map((v, i) => (
          <div className="heat__bar" key={i}>
            <div className="heat__track">
              <div className="heat__col" style={{ height: `${Math.round((v / max) * 100)}%` }} />
            </div>
            <span className="heat__lb">{String(i + 1).padStart(2, "0")}</span>
          </div>
        ))}
      </div>
      <div className="heat__cap">互动热度</div>
    </div>
  );
}

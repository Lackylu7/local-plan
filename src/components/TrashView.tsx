import type { TrashEntry } from "../types";

export function TrashView({
  trash,
  onRestore,
  onPermanentDelete,
  onClear,
}: {
  trash: TrashEntry[];
  onRestore: (entry: TrashEntry) => void;
  onPermanentDelete: (entry: TrashEntry) => void;
  onClear: () => void;
}) {
  return (
    <section className="view-content trash-view" aria-label="回收站">
      <div className="trash-heading">
        <div>
          <h2>回收站</h2>
          <p>删除的任务和笔记会保留在这里；可在数据菜单启用 30 天自动清理。</p>
        </div>
        <button type="button" className="clear-button danger" onClick={onClear} disabled={trash.length === 0}>
          清空回收站
        </button>
      </div>

      <div className="content-scroll trash-scroll">
        {trash.length === 0 ? (
          <p className="empty">回收站是空的。</p>
        ) : (
          <ul className="trash-list">
            {trash.map((entry) => {
              const isTask = entry.entityType === "task";
              const preview = isTask ? entry.payload.details : entry.payload.content;
              return (
                <li className="trash-card" key={`${entry.entityType}-${entry.payload.id}`}>
                  <div className="trash-card-main">
                    <div className="trash-card-meta">
                      <span className={`entity-badge ${entry.entityType}`}>{isTask ? "任务" : "笔记"}</span>
                      <time dateTime={entry.deletedAt}>删除于 {formatDate(entry.deletedAt)}</time>
                    </div>
                    <h3>{entry.payload.title || "无标题笔记"}</h3>
                    <p>{preview || (isTask ? "没有补充内容" : "没有正文")}</p>
                  </div>
                  <div className="trash-actions">
                    <button type="button" className="restore-button" onClick={() => onRestore(entry)}>
                      恢复
                    </button>
                    <button type="button" className="delete-button" onClick={() => onPermanentDelete(entry)}>
                      永久删除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

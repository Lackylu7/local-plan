import { useEffect, useRef, useState } from "react";

export function DataMenu({
  busy,
  notice,
  closeKey,
  autoCleanupEnabled,
  onAutoCleanupChange,
  lastBackupAt,
  onExport,
  onImport,
}: {
  busy: boolean;
  notice: string;
  closeKey: string;
  autoCleanupEnabled: boolean;
  onAutoCleanupChange: (enabled: boolean) => void;
  lastBackupAt: string;
  onExport: () => void;
  onImport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [closeKey]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function runAction(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="data-menu-wrap">
      <div className={open ? "data-menu open" : "data-menu"} ref={menuRef}>
        <button
          type="button"
          className="data-menu-trigger"
          aria-expanded={open}
          aria-controls="data-menu-popover"
          onClick={() => setOpen((current) => !current)}
        >
          数据
        </button>
        {open && (
          <div className="data-menu-popover" id="data-menu-popover">
            <strong>备份与恢复</strong>
            <p>导出或覆盖恢复任务、笔记和回收站。</p>
            <p className="last-backup">
              {lastBackupAt
                ? `最近自动备份：${formatBackupTime(lastBackupAt)}`
                : "尚未生成自动备份"}
            </p>
            <button type="button" onClick={() => runAction(onExport)} disabled={busy}>
              导出备份
            </button>
            <button type="button" onClick={() => runAction(onImport)} disabled={busy}>
              导入备份
            </button>
            <div className="data-menu-divider" />
            <strong>回收站</strong>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={autoCleanupEnabled}
                onChange={(event) => onAutoCleanupChange(event.currentTarget.checked)}
              />
              <span>自动清理 30 天前的回收站项目</span>
            </label>
          </div>
        )}
      </div>
      {notice && <span className="data-notice" role="status">{notice}</span>}
    </div>
  );
}

function formatBackupTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

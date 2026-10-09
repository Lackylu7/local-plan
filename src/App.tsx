import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { DataMenu } from "./components/DataMenu";
import { NotesView } from "./components/NotesView";
import { TaskView } from "./components/TaskView";
import { TrashView } from "./components/TrashView";
import {
  clearTrash,
  loadAppState,
  moveToTrash,
  permanentlyDeleteFromTrash,
  previewBackup,
  removeExpiredTrash,
  restoreFromTrash,
  searchAll,
  serializeBackup,
} from "./storage";
import type { AppStateV2, ImageAttachment, TrashEntry } from "./types";

interface LocalPlanSettingsApi {
  getFloatVisible: () => Promise<boolean>;
  setFloatVisible: (visible: boolean) => Promise<boolean>;
}

interface BackupResult {
  status: "saved" | "selected" | "cancelled" | "error";
  content?: string;
  path?: string;
  savedAt?: string;
  error?: string;
}

interface LocalPlanBackupApi {
  exportBackup: (payload: { content: string; suggestedName: string }) => Promise<BackupResult>;
  importBackup: () => Promise<BackupResult>;
  autoBackup?: (payload: { content: string }) => Promise<BackupResult>;
}

declare global {
  interface Window {
    localPlanSettings?: LocalPlanSettingsApi;
    localPlanBackup?: LocalPlanBackupApi;
  }
}

type ActiveView = "tasks" | "notes" | "trash";
interface UndoDeletion {
  items: Array<{
    entityType: "task" | "note";
    entityId: string;
  }>;
  label: string;
}
type PendingImport = ReturnType<typeof previewBackup>;

const APP_STATE_KEY = "local-plan-state-v2";
const LEGACY_TASKS_KEY = "local-plan-simple-tasks-v1";
const LEGACY_NOTES_KEY = "local-plan-simple-notes-v1";
const FLOAT_VISIBLE_KEY = "local-plan-float-visible-v1";
const AUTO_CLEANUP_KEY = "local-plan-auto-cleanup-v1";
const LAST_BACKUP_KEY = "local-plan-last-auto-backup-v1";

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadInitialState() {
  return loadAppState(
    localStorage.getItem(APP_STATE_KEY),
    localStorage.getItem(LEGACY_TASKS_KEY),
    localStorage.getItem(LEGACY_NOTES_KEY),
    new Date().toISOString(),
  );
}

function loadFloatVisible() {
  return localStorage.getItem(FLOAT_VISIBLE_KEY) !== "false";
}

function loadAutoCleanup() {
  return localStorage.getItem(AUTO_CLEANUP_KEY) === "true";
}

function App() {
  const [state, setState] = useState<AppStateV2>(loadInitialState);
  const [activeView, setActiveView] = useState<ActiveView>("tasks");
  const [floatVisible, setFloatVisible] = useState(loadFloatVisible);
  const [autoCleanupEnabled, setAutoCleanupEnabled] = useState(loadAutoCleanup);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNotice, setBackupNotice] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState(
    () => localStorage.getItem(LAST_BACKUP_KEY) || "",
  );
  const [undoDeletion, setUndoDeletion] = useState<UndoDeletion | null>(null);
  const [query, setQuery] = useState("");
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResults = useMemo(() => searchAll(state, query), [state, query]);

  useEffect(() => {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const autoBackup = window.localPlanBackup?.autoBackup;
    if (!autoBackup) return;
    const timeout = window.setTimeout(async () => {
      try {
        const result = await autoBackup({
          content: serializeBackup(state, new Date().toISOString()),
        });
        if (result.status === "saved" && result.savedAt) {
          localStorage.setItem(LAST_BACKUP_KEY, result.savedAt);
          setLastBackupAt(result.savedAt);
        }
      } catch {
        // Automatic backup retries after the next state change.
      }
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    localStorage.setItem(FLOAT_VISIBLE_KEY, String(floatVisible));
    window.localPlanSettings?.setFloatVisible(floatVisible).then((confirmedVisible) => {
      if (confirmedVisible !== floatVisible) setFloatVisible(confirmedVisible);
    });
  }, [floatVisible]);

  useEffect(() => {
    function focusTaskInputOnActivation() {
      if (document.visibilityState !== "visible") return;
      setActiveView("tasks");
      setQuery("");
      window.requestAnimationFrame(() => document.getElementById("tasks-new-title")?.focus());
    }

    document.addEventListener("visibilitychange", focusTaskInputOnActivation);
    return () => document.removeEventListener("visibilitychange", focusTaskInputOnActivation);
  }, []);

  useEffect(() => {
    localStorage.setItem(AUTO_CLEANUP_KEY, String(autoCleanupEnabled));
    if (autoCleanupEnabled) {
      setState((current) =>
        removeExpiredTrash(current, new Date().toISOString(), 30),
      );
    }
  }, [autoCleanupEnabled]);

  useEffect(() => {
    if (!undoDeletion) return;
    const timeout = window.setTimeout(() => setUndoDeletion(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [undoDeletion]);

  useEffect(() => {
    if (!pendingImport) return;
    function closePreview(event: KeyboardEvent) {
      if (event.key === "Escape") setPendingImport(null);
    }
    window.addEventListener("keydown", closePreview);
    return () => window.removeEventListener("keydown", closePreview);
  }, [pendingImport]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const key = event.key.toLocaleLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "f") {
        event.preventDefault();
        if (activeView === "trash") {
          setActiveView("tasks");
          window.requestAnimationFrame(() => searchInputRef.current?.focus());
        } else {
          searchInputRef.current?.focus();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "n") {
        event.preventDefault();
        const targetView = activeView === "notes" ? "notes" : "tasks";
        if (activeView === "trash") {
          setActiveView("tasks");
          window.requestAnimationFrame(() => {
            document.getElementById("tasks-new-title")?.focus();
          });
        } else {
          document.getElementById(`${targetView}-new-title`)?.focus();
        }
        return;
      }

      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        setQuery("");
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeView]);

  function addTask(title: string, details: string, attachments: ImageAttachment[]) {
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      tasks: [
        {
          id: createId(),
          title: title.trim(),
          details: details.trim(),
          progress: 0,
          done: false,
          createdAt: now,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        ...current.tasks,
      ],
    }));
  }

  function toggleTask(taskId: string) {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const done = !task.done;
        return {
          ...task,
          done,
          progress: done ? 100 : task.progress,
          completedAt: done ? new Date().toISOString() : undefined,
        };
      }),
    }));
  }

  function updateTask(taskId: string, title: string, details: string, attachments: ImageAttachment[]) {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              title: title.trim(),
              details: details.trim(),
              attachments: attachments.length > 0 ? attachments : undefined,
            }
          : task,
      ),
    }));
  }

  function updateProgress(taskId: string, progress: number) {
    const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, progress: safeProgress } : task,
      ),
    }));
  }

  function deleteItem(entityType: "task" | "note", entityId: string) {
    const item =
      entityType === "task"
        ? state.tasks.find((task) => task.id === entityId)
        : state.notes.find((note) => note.id === entityId);
    if (!item) return;
    setUndoDeletion({
      items: [{ entityType, entityId }],
      label: item.title || "无标题笔记",
    });
    setState((current) => moveToTrash(current, entityType, entityId, new Date().toISOString()));
  }

  function undoLastDeletion() {
    if (!undoDeletion) return;
    setState((current) =>
      undoDeletion.items.reduce(
        (next, item) =>
          restoreFromTrash(next, item.entityType, item.entityId),
        current,
      ),
    );
    setUndoDeletion(null);
  }

  function clearCompletedTasks() {
    const completedIds = state.tasks.filter((task) => task.done).map((task) => task.id);
    if (completedIds.length === 0) return;
    const deletedAt = new Date().toISOString();
    setUndoDeletion({
      items: completedIds.map((entityId) => ({ entityType: "task", entityId })),
      label: `${completedIds.length} 个已完成任务`,
    });
    setState((current) =>
      completedIds.reduce(
        (nextState, taskId) => moveToTrash(nextState, "task", taskId, deletedAt),
        current,
      ),
    );
  }

  function addNote(title: string, content: string, attachments: ImageAttachment[]) {
    setState((current) => ({
      ...current,
      notes: [
        {
          id: createId(),
          title: title.trim(),
          content: content.trim(),
          createdAt: new Date().toISOString(),
          pinned: false,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        ...current.notes,
      ],
    }));
  }

  function updateNote(noteId: string, title: string, content: string, attachments: ImageAttachment[]) {
    setState((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              title: title.trim(),
              content: content.trim(),
              attachments: attachments.length > 0 ? attachments : undefined,
            }
          : note,
      ),
    }));
  }

  function toggleNotePinned(noteId: string) {
    setState((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === noteId ? { ...note, pinned: note.pinned !== true } : note,
      ),
    }));
  }

  function restoreItem(entry: TrashEntry) {
    setState((current) => restoreFromTrash(current, entry.entityType, entry.payload.id));
  }

  function permanentlyDelete(entry: TrashEntry) {
    if (!window.confirm(`“${entry.payload.title}”将被永久删除，且无法恢复。确定继续吗？`)) return;
    setState((current) =>
      permanentlyDeleteFromTrash(current, entry.entityType, entry.payload.id),
    );
  }

  function emptyTrash() {
    if (state.trash.length === 0) return;
    if (!window.confirm(`确定永久删除回收站中的 ${state.trash.length} 个项目吗？`)) return;
    setState((current) => clearTrash(current));
  }

  async function exportBackup() {
    const api = window.localPlanBackup;
    if (!api) {
      setBackupNotice("请在桌面应用中使用备份功能");
      return;
    }
    setBackupBusy(true);
    setBackupNotice("正在导出...");
    try {
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const result = await api.exportBackup({
        content: serializeBackup(state, now.toISOString()),
        suggestedName: `local-plan-backup-${date}.json`,
      });
      if (result.status === "saved") setBackupNotice("备份已导出");
      else if (result.status === "cancelled") setBackupNotice("已取消导出");
      else setBackupNotice(result.error || "导出失败");
    } catch (error) {
      setBackupNotice(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup() {
    const api = window.localPlanBackup;
    if (!api) {
      setBackupNotice("请在桌面应用中使用备份功能");
      return;
    }
    setBackupBusy(true);
    setBackupNotice("正在读取备份...");
    try {
      const result = await api.importBackup();
      if (result.status === "cancelled") {
        setBackupNotice("已取消导入");
        return;
      }
      if (result.status !== "selected" || typeof result.content !== "string") {
        setBackupNotice(result.error || "读取备份失败");
        return;
      }
      setPendingImport(previewBackup(result.content));
      setBackupNotice("请确认导入内容");
    } catch (error) {
      setBackupNotice(error instanceof Error ? error.message : "备份格式无效");
    } finally {
      setBackupBusy(false);
    }
  }

  function confirmImport() {
    if (!pendingImport) return;
    setState(pendingImport.state);
    setPendingImport(null);
    setBackupNotice("备份已恢复");
  }

  return (
    <main className="app">
      <section className="panel">
        <header className="header">
          <div className="title-group">
            <div className="brand-mark">LP</div>
            <div>
              <p className="app-name">Local Plan</p>
              <h1>任务与笔记</h1>
              <p>记下要做的事，也留住随时想到的内容。</p>
            </div>
          </div>
          <div className="header-tools">
            <DataMenu
              busy={backupBusy}
              notice={backupNotice}
              closeKey={activeView}
              autoCleanupEnabled={autoCleanupEnabled}
              onAutoCleanupChange={setAutoCleanupEnabled}
              lastBackupAt={lastBackupAt}
              onExport={exportBackup}
              onImport={importBackup}
            />
            <button
              type="button"
              className={floatVisible ? "float-toggle active" : "float-toggle"}
              onClick={() => setFloatVisible((current) => !current)}
              aria-pressed={floatVisible}
            >
              {floatVisible ? "隐藏悬浮按钮" : "显示悬浮按钮"}
            </button>
            <span className="shortcut">Ctrl + Alt + Space</span>
          </div>
        </header>

        <div className="view-tabs" role="tablist" aria-label="内容视图">
          <ViewTab
            label="任务"
            count={state.tasks.length}
            active={activeView === "tasks"}
            onClick={() => setActiveView("tasks")}
          />
          <ViewTab
            label="笔记"
            count={state.notes.length}
            active={activeView === "notes"}
            onClick={() => setActiveView("notes")}
          />
          <ViewTab
            label="回收站"
            count={state.trash.length}
            active={activeView === "trash"}
            onClick={() => setActiveView("trash")}
          />
        </div>

        {activeView !== "trash" && (
          <label className="search-field global-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="搜索任务和笔记"
              aria-label="搜索任务和笔记"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="清除搜索">
                清除
              </button>
            )}
          </label>
        )}

        {activeView === "tasks" && (
          <TaskView
            tasks={searchResults.tasks}
            allTasks={state.tasks}
            query={query}
            onAdd={addTask}
            onToggle={toggleTask}
            onUpdate={updateTask}
            onProgressChange={updateProgress}
            onDelete={(taskId) => deleteItem("task", taskId)}
            onClearDone={clearCompletedTasks}
          />
        )}
        {activeView === "notes" && (
          <NotesView
            notes={searchResults.notes}
            totalCount={state.notes.length}
            query={query}
            onAdd={addNote}
            onUpdate={updateNote}
            onTogglePin={toggleNotePinned}
            onDelete={(noteId) => deleteItem("note", noteId)}
          />
        )}
        {activeView === "trash" && (
          <TrashView
            trash={state.trash}
            onRestore={restoreItem}
            onPermanentDelete={permanentlyDelete}
            onClear={emptyTrash}
          />
        )}
      </section>
      {undoDeletion && (
        <div className="undo-toast" role="status" aria-live="polite">
          <span>{undoDeletion.label}已移入回收站</span>
          <button type="button" onClick={undoLastDeletion}>
            撤销删除
          </button>
        </div>
      )}
      {pendingImport && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-preview-title"
          >
            <div className="dialog-heading">
              <div>
                <p className="dialog-eyebrow">已验证备份</p>
                <h2 id="import-preview-title">导入备份预览</h2>
              </div>
              <button
                type="button"
                className="dialog-close"
                onClick={() => setPendingImport(null)}
                aria-label="关闭导入预览"
              >
                ×
              </button>
            </div>
            <p className="dialog-description">
              确认后将覆盖当前任务、笔记和回收站，此操作不会删除备份文件。
            </p>
            <dl className="import-summary">
              <div>
                <dt>任务{" "}</dt>
                <dd>{pendingImport.summary.taskCount}</dd>
              </div>
              <div>
                <dt>笔记{" "}</dt>
                <dd>{pendingImport.summary.noteCount}</dd>
              </div>
              <div>
                <dt>回收站{" "}</dt>
                <dd>{pendingImport.summary.trashCount}</dd>
              </div>
            </dl>
            <p className="backup-date">
              备份日期 {formatDateTime(pendingImport.summary.exportedAt)}
            </p>
            <div className="dialog-actions">
              <button type="button" className="edit-button" onClick={() => setPendingImport(null)}>
                取消
              </button>
              <button type="button" className="save-button" onClick={confirmImport}>
                确认导入
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ViewTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "view-tab active" : "view-tab"}
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      {label}
      <span>{count}</span>
    </button>
  );
}

export default App;

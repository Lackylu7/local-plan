import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from "react";
import "./App.css";

interface Task {
  id: string;
  title: string;
  details: string;
  progress: number;
  done: boolean;
  createdAt: string;
  completedAt?: string;
}

const STORAGE_KEY = "local-plan-simple-tasks-v1";

const text = {
  appName: "Local Plan",
  title: "\u4efb\u52a1\u6e05\u5355",
  subtitle:
    "\u624b\u52a8\u6dfb\u52a0\uff0c\u5b8c\u6210\u5c31\u70b9\u4e00\u4e0b\uff0c\u5c0f\u4efb\u52a1\u4e5f\u80fd\u968f\u65f6\u8bb0\u3002",
  shortcut: "Ctrl + Alt + Space",
  placeholder: "\u8f93\u5165\u4e00\u4e2a\u4efb\u52a1...",
  detailsPlaceholder:
    "\u8865\u5145\u5c0f\u4efb\u52a1 / \u5907\u6ce8\uff0c\u53ef\u4e00\u884c\u4e00\u4e2a...",
  detailsLabel: "\u5c0f\u4efb\u52a1 / \u5907\u6ce8",
  add: "\u6dfb\u52a0",
  todo: "\u672a\u5b8c\u6210",
  done: "\u5df2\u5b8c\u6210",
  progress: "\u8fdb\u5ea6",
  averageProgress: "\u5e73\u5747\u8fdb\u5ea6",
  progressHint: "\u62d6\u52a8\u8c03\u6574\u4efb\u52a1\u8fdb\u5ea6",
  complete: "\u5b8c\u6210",
  undo: "\u6062\u590d",
  edit: "\u7f16\u8f91",
  save: "\u4fdd\u5b58",
  cancel: "\u53d6\u6d88",
  empty: "\u8fd8\u6ca1\u6709\u4efb\u52a1\uff0c\u5148\u6dfb\u52a0\u4e00\u4e2a\u3002",
  clearDone: "\u6e05\u9664\u5df2\u5b8c\u6210",
  brand: "LP",
};

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeProgress(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): Task[] => {
      if (typeof item?.id !== "string" || typeof item?.title !== "string") return [];
      return [
        {
          id: item.id,
          title: item.title,
          details: typeof item.details === "string" ? item.details : "",
          progress:
            typeof item.progress === "number"
              ? normalizeProgress(item.progress)
              : item.done === true
                ? 100
                : 0,
          done: item.done === true,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
          completedAt: typeof item.completedAt === "string" ? item.completedAt : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const todoTasks = useMemo(() => tasks.filter((task) => !task.done), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.done), [tasks]);
  const averageProgress = useMemo(() => {
    if (tasks.length === 0) return 0;
    const total = tasks.reduce((sum, task) => sum + task.progress, 0);
    return Math.round(total / tasks.length);
  }, [tasks]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setTasks((current) => [
      {
        id: createId(),
        title: cleanTitle,
        details: details.trim(),
        progress: 0,
        done: false,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setTitle("");
    setDetails("");
  }

  function toggleTask(taskId: string) {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const done = !task.done;
        return {
          ...task,
          done,
          progress: done ? 100 : task.progress,
          completedAt: done ? new Date().toISOString() : undefined,
        };
      }),
    );
  }

  function updateTask(taskId: string, nextTitle: string, nextDetails: string) {
    const cleanTitle = nextTitle.trim();
    if (!cleanTitle) return;

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              title: cleanTitle,
              details: nextDetails.trim(),
            }
          : task,
      ),
    );
  }

  function updateProgress(taskId: string, nextProgress: number) {
    const progress = normalizeProgress(nextProgress);
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const done = progress === 100;
        return {
          ...task,
          progress,
          done,
          completedAt: done ? (task.completedAt ?? new Date().toISOString()) : undefined,
        };
      }),
    );
  }

  function clearDone() {
    setTasks((current) => current.filter((task) => !task.done));
  }

  return (
    <main className="app">
      <section className="panel">
        <header className="header">
          <div className="title-group">
            <div className="brand-mark">{text.brand}</div>
            <div>
              <p className="app-name">{text.appName}</p>
              <h1>{text.title}</h1>
              <p>{text.subtitle}</p>
            </div>
          </div>
          <span className="shortcut">{text.shortcut}</span>
        </header>

        <form className="add-form" onSubmit={addTask}>
          <div className="add-fields">
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder={text.placeholder}
            />
            <textarea
              value={details}
              onChange={(event) => setDetails(event.currentTarget.value)}
              placeholder={text.detailsPlaceholder}
              rows={3}
            />
          </div>
          <button type="submit">{text.add}</button>
        </form>

        <div className="summary" aria-label="task summary">
          <div className="summary-card">
            <span>{text.todo}</span>
            <strong>{todoTasks.length}</strong>
          </div>
          <div className="summary-card progress-summary">
            <span>{text.averageProgress}</span>
            <strong>{averageProgress}%</strong>
          </div>
          <div className="summary-card">
            <span>{text.done}</span>
            <strong>{doneTasks.length}</strong>
          </div>
        </div>

        <section className="list-section">
          <h2>{text.todo}</h2>
          {todoTasks.length === 0 ? (
            <p className="empty">{text.empty}</p>
          ) : (
            <ul className="task-list">
              {todoTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onProgressChange={updateProgress}
                  onToggle={toggleTask}
                  onUpdate={updateTask}
                />
              ))}
            </ul>
          )}
        </section>

        {doneTasks.length > 0 && (
          <section className="list-section done-section">
            <div className="section-title">
              <h2>{text.done}</h2>
              <button type="button" className="clear-button" onClick={clearDone}>
                {text.clearDone}
              </button>
            </div>
            <ul className="task-list">
              {doneTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onProgressChange={updateProgress}
                  onToggle={toggleTask}
                  onUpdate={updateTask}
                />
              ))}
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}

function TaskRow({
  task,
  onProgressChange,
  onToggle,
  onUpdate,
}: {
  task: Task;
  onProgressChange: (taskId: string, nextProgress: number) => void;
  onToggle: (taskId: string) => void;
  onUpdate: (taskId: string, nextTitle: string, nextDetails: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDetails, setDraftDetails] = useState(task.details);

  function startEditing() {
    setDraftTitle(task.title);
    setDraftDetails(task.details);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(task.title);
    setDraftDetails(task.details);
    setIsEditing(false);
  }

  function saveEditing() {
    if (!draftTitle.trim()) return;
    onUpdate(task.id, draftTitle, draftDetails);
    setIsEditing(false);
  }

  const rowStyle = getProgressStyle(task.progress);

  return (
    <li className={task.done ? "task-row done" : "task-row"} style={rowStyle}>
      <span className="status-dot" aria-hidden="true" />
      <div className="task-content">
        {isEditing ? (
          <>
            <input
              className="edit-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveEditing();
                if (event.key === "Escape") cancelEditing();
              }}
              autoFocus
            />
            <label className="details-label" htmlFor={`details-${task.id}`}>
              {text.detailsLabel}
            </label>
            <textarea
              id={`details-${task.id}`}
              className="edit-details"
              value={draftDetails}
              onChange={(event) => setDraftDetails(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelEditing();
              }}
              placeholder={text.detailsPlaceholder}
              rows={3}
            />
          </>
        ) : (
          <>
            <span className="task-title">{task.title}</span>
            {task.details && <span className="task-details">{task.details}</span>}
          </>
        )}
        <div className="progress-control">
          <div className="progress-meta">
            <span>{text.progress}</span>
            <strong>{task.progress}%</strong>
          </div>
          <input
            aria-label={`${task.title} ${text.progress}`}
            className="progress-slider"
            max="100"
            min="0"
            onChange={(event) => onProgressChange(task.id, event.currentTarget.valueAsNumber)}
            step="1"
            title={text.progressHint}
            type="range"
            value={task.progress}
          />
        </div>
      </div>
      <div className="task-actions">
        {isEditing ? (
          <>
            <button type="button" className="save-button" onClick={saveEditing}>
              {text.save}
            </button>
            <button type="button" className="edit-button" onClick={cancelEditing}>
              {text.cancel}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="complete-button" onClick={() => onToggle(task.id)}>
              {task.done ? text.undo : text.complete}
            </button>
            <button type="button" className="edit-button" onClick={startEditing}>
              {text.edit}
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function getProgressStyle(progress: number): CSSProperties {
  const hue = 214 - progress * 0.64;
  return {
    "--progress": `${progress}%`,
    "--progress-border": `hsl(${hue} 64% 78%)`,
    "--progress-color": `hsl(${hue} 72% 42%)`,
    "--progress-soft": `hsl(${hue} 76% 96%)`,
  } as CSSProperties;
}

export default App;

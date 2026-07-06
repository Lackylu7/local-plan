import { FormEvent, useEffect, useMemo, useState } from "react";
import "./App.css";

interface Task {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  completedAt?: string;
}

const STORAGE_KEY = "local-plan-simple-tasks-v1";

const text = {
  appName: "Local Plan",
  title: "\u4efb\u52a1\u6e05\u5355",
  subtitle: "\u624b\u52a8\u6dfb\u52a0\uff0c\u5b8c\u6210\u5c31\u70b9\u4e00\u4e0b\u3002",
  shortcut: "Ctrl + Alt + Space",
  placeholder: "\u8f93\u5165\u4e00\u4e2a\u4efb\u52a1...",
  add: "\u6dfb\u52a0",
  todo: "\u672a\u5b8c\u6210",
  done: "\u5df2\u5b8c\u6210",
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

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Task => {
      return typeof item?.id === "string" && typeof item?.title === "string";
    });
  } catch {
    return [];
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [title, setTitle] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const todoTasks = useMemo(() => tasks.filter((task) => !task.done), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.done), [tasks]);

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setTasks((current) => [
      {
        id: createId(),
        title: cleanTitle,
        done: false,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setTitle("");
  }

  function toggleTask(taskId: string) {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const done = !task.done;
        return {
          ...task,
          done,
          completedAt: done ? new Date().toISOString() : undefined,
        };
      }),
    );
  }

  function renameTask(taskId: string, nextTitle: string) {
    const cleanTitle = nextTitle.trim();
    if (!cleanTitle) return;

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              title: cleanTitle,
            }
          : task,
      ),
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
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder={text.placeholder}
          />
          <button type="submit">{text.add}</button>
        </form>

        <div className="summary" aria-label="task summary">
          <div className="summary-card">
            <span>{text.todo}</span>
            <strong>{todoTasks.length}</strong>
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
                <TaskRow key={task.id} task={task} onToggle={toggleTask} onRename={renameTask} />
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
                <TaskRow key={task.id} task={task} onToggle={toggleTask} onRename={renameTask} />
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
  onToggle,
  onRename,
}: {
  task: Task;
  onToggle: (taskId: string) => void;
  onRename: (taskId: string, nextTitle: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);

  function startEditing() {
    setDraftTitle(task.title);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(task.title);
    setIsEditing(false);
  }

  function saveEditing() {
    if (!draftTitle.trim()) return;
    onRename(task.id, draftTitle);
    setIsEditing(false);
  }

  return (
    <li className={task.done ? "task-row done" : "task-row"}>
      <span className="status-dot" aria-hidden="true" />
      {isEditing ? (
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
      ) : (
        <span className="task-title">{task.title}</span>
      )}
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

export default App;

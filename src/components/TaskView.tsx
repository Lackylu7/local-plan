import { type ClipboardEvent, type CSSProperties, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MAX_IMAGE_ATTACHMENTS, readImageFiles } from "../attachments";
import type { ImageAttachment, Task } from "../types";
import { ImageAttachments } from "./ImageAttachments";

const copy = {
  placeholder: "输入一个任务...",
  detailsPlaceholder: "补充小任务 / 备注，可一行一个...",
  detailsLabel: "小任务 / 备注",
  add: "添加",
  todo: "未完成",
  done: "已完成",
  progress: "进度",
  averageProgress: "平均进度",
  progressHint: "拖动调整任务进度",
  complete: "完成",
  undo: "恢复",
  edit: "编辑",
  save: "保存",
  cancel: "取消",
  delete: "删除",
  empty: "还没有任务，先添加一个。",
  noResults: "没有找到匹配的任务。",
  search: "搜索任务标题或补充内容",
  clearDone: "移入回收站",
};

export function TaskView({
  tasks,
  allTasks,
  query,
  onAdd,
  onToggle,
  onUpdate,
  onProgressChange,
  onDelete,
  onClearDone,
}: {
  tasks: Task[];
  allTasks: Task[];
  query: string;
  onAdd: (title: string, details: string, attachments: ImageAttachment[]) => void;
  onToggle: (taskId: string) => void;
  onUpdate: (taskId: string, title: string, details: string, attachments: ImageAttachment[]) => void;
  onProgressChange: (taskId: string, progress: number) => void;
  onDelete: (taskId: string) => void;
  onClearDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const todoTasks = useMemo(() => tasks.filter((task) => !task.done), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((task) => task.done), [tasks]);
  const totalDone = useMemo(
    () => allTasks.filter((task) => task.done).length,
    [allTasks],
  );
  const averageProgress = useMemo(() => {
    if (allTasks.length === 0) return 0;
    return Math.round(
      allTasks.reduce((sum, task) => sum + task.progress, 0) / allTasks.length,
    );
  }, [allTasks]);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() && attachments.length === 0) return;
    onAdd(title, details, attachments);
    setTitle("");
    setDetails("");
    setAttachments([]);
    setAttachmentNotice("");
  }

  async function addFiles(files: FileList | File[]) {
    try {
      const result = await readImageFiles(files, MAX_IMAGE_ATTACHMENTS - attachments.length);
      setAttachments((current) => [...current, ...result.attachments]);
      setAttachmentNotice(result.skipped > 0 ? "已达到每条内容 3 张图片的上限。" : "");
    } catch (error) {
      setAttachmentNotice(error instanceof Error ? error.message : "图片添加失败。");
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length === 0) return;
    event.preventDefault();
    void addFiles(imageFiles);
  }

  function handleDragEnter(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
  }

  const hasQuery = query.trim().length > 0;

  return (
    <section className="view-content" aria-label="任务">
      <form
        className={isDragging ? "add-form is-dragging" : "add-form"}
        aria-label="任务输入区"
        onSubmit={submitTask}
        onPaste={handlePaste}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={handleDrop}
      >
        <div className="add-fields">
          <input
            id="tasks-new-title"
            ref={titleInputRef}
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder={copy.placeholder}
          />
          <textarea
            value={details}
            onChange={(event) => setDetails(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={copy.detailsPlaceholder}
            rows={3}
          />
          <ImageAttachments
            attachments={attachments}
            onChange={setAttachments}
            notice={attachmentNotice}
          />
          {isDragging && <p className="image-drop-hint">松开即可添加图片</p>}
        </div>
        <button type="submit" disabled={!title.trim() && attachments.length === 0}>
          {copy.add}
        </button>
      </form>

      <div className="summary" aria-label="任务概览">
        <div className="summary-card">
          <span>{copy.todo}</span>
          <strong>{allTasks.length - totalDone}</strong>
        </div>
        <div className="summary-card progress-summary">
          <span>{copy.averageProgress}</span>
          <strong>{averageProgress}%</strong>
        </div>
        <div className="summary-card">
          <span>{copy.done}</span>
          <strong>{totalDone}</strong>
        </div>
      </div>

      <div className="content-scroll task-scroll">
        {tasks.length === 0 ? (
          <p className="empty">{hasQuery ? copy.noResults : copy.empty}</p>
        ) : (
          <>
            <section className="list-section">
              <h2>{copy.todo}</h2>
              {todoTasks.length === 0 ? (
                <p className="section-empty">{hasQuery ? "没有匹配的未完成任务。" : "所有任务都已完成。"}</p>
              ) : (
                <ul className="task-list">
                  {todoTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onDelete={onDelete}
                      onProgressChange={onProgressChange}
                      onToggle={onToggle}
                      onUpdate={onUpdate}
                    />
                  ))}
                </ul>
              )}
            </section>

            {doneTasks.length > 0 && (
              <section className="list-section done-section">
                <div className="section-title">
                  <h2>{copy.done}</h2>
                  {!hasQuery && (
                    <button type="button" className="clear-button" onClick={onClearDone}>
                      {copy.clearDone}
                    </button>
                  )}
                </div>
                <ul className="task-list">
                  {doneTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onDelete={onDelete}
                      onProgressChange={onProgressChange}
                      onToggle={onToggle}
                      onUpdate={onUpdate}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  onProgressChange,
  onToggle,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onProgressChange: (taskId: string, progress: number) => void;
  onToggle: (taskId: string) => void;
  onUpdate: (taskId: string, title: string, details: string, attachments: ImageAttachment[]) => void;
  onDelete: (taskId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDetails, setDraftDetails] = useState(task.details);
  const [draftAttachments, setDraftAttachments] = useState<ImageAttachment[]>(task.attachments ?? []);
  const [attachmentNotice, setAttachmentNotice] = useState("");

  function startEditing() {
    setDraftTitle(task.title);
    setDraftDetails(task.details);
    setDraftAttachments(task.attachments ?? []);
    setAttachmentNotice("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(task.title);
    setDraftDetails(task.details);
    setIsEditing(false);
  }

  function saveEditing() {
    if (!draftTitle.trim()) return;
    onUpdate(task.id, draftTitle, draftDetails, draftAttachments);
    setIsEditing(false);
  }

  async function addFiles(files: FileList | File[]) {
    try {
      const result = await readImageFiles(files, MAX_IMAGE_ATTACHMENTS - draftAttachments.length);
      setDraftAttachments((current) => [...current, ...result.attachments]);
      setAttachmentNotice(result.skipped > 0 ? "已达到每条内容 3 张图片的上限。" : "");
    } catch (error) {
      setAttachmentNotice(error instanceof Error ? error.message : "图片添加失败。");
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLLIElement>) {
    if (!isEditing) return;
    const imageFiles = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length === 0) return;
    event.preventDefault();
    void addFiles(imageFiles);
  }

  return (
    <li className={task.done ? "task-row done" : "task-row"} style={getProgressStyle(task.progress)} onPaste={handlePaste}>
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
              {copy.detailsLabel}
            </label>
            <textarea
              id={`details-${task.id}`}
              className="edit-details"
              value={draftDetails}
              onChange={(event) => setDraftDetails(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelEditing();
              }}
              placeholder={copy.detailsPlaceholder}
              rows={3}
            />
            <ImageAttachments
              attachments={draftAttachments}
              onChange={setDraftAttachments}
              notice={attachmentNotice}
            />
          </>
        ) : (
          <>
            <span className="task-title">{task.title}</span>
            {task.details && <span className="task-details">{task.details}</span>}
            <ImageAttachments attachments={task.attachments} />
          </>
        )}
        <div className="progress-control">
          <div className="progress-meta">
            <span>{copy.progress}</span>
            <strong>{task.progress}%</strong>
          </div>
          <input
            aria-label={`${task.title} ${copy.progress}`}
            className="progress-slider"
            max="100"
            min="0"
            onChange={(event) => onProgressChange(task.id, event.currentTarget.valueAsNumber)}
            step="1"
            title={copy.progressHint}
            type="range"
            value={task.progress}
          />
        </div>
      </div>
      <div className="task-actions">
        {isEditing ? (
          <>
            <button type="button" className="save-button" onClick={saveEditing} disabled={!draftTitle.trim()}>
              {copy.save}
            </button>
            <button type="button" className="edit-button" onClick={cancelEditing}>
              {copy.cancel}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="complete-button" onClick={() => onToggle(task.id)}>
              {task.done ? copy.undo : copy.complete}
            </button>
            <button type="button" className="edit-button" onClick={startEditing}>
              {copy.edit}
            </button>
            <button type="button" className="delete-button" onClick={() => onDelete(task.id)}>
              {copy.delete}
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

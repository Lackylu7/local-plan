import { type ClipboardEvent, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MAX_IMAGE_ATTACHMENTS, readImageFiles } from "../attachments";
import { sortNotes } from "../storage";
import type { ImageAttachment, Note } from "../types";
import { ImageAttachments } from "./ImageAttachments";

const NOTE_DRAFT_KEY = "local-plan-note-draft-v1";

function loadNoteDraft() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTE_DRAFT_KEY) || "{}") as {
      title?: unknown;
      content?: unknown;
    };
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      content: typeof parsed.content === "string" ? parsed.content : "",
    };
  } catch {
    return { title: "", content: "" };
  }
}

export function NotesView({
  notes,
  totalCount,
  query,
  onAdd,
  onUpdate,
  onTogglePin,
  onDelete,
}: {
  notes: Note[];
  totalCount: number;
  query: string;
  onAdd: (title: string, content: string, attachments: ImageAttachment[]) => void;
  onUpdate: (noteId: string, title: string, content: string, attachments: ImageAttachment[]) => void;
  onTogglePin: (noteId: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const initialDraft = useMemo(loadNoteDraft, []);
  const [title, setTitle] = useState(initialDraft.title);
  const [content, setContent] = useState(initialDraft.content);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const filteredNotes = useMemo(() => sortNotes(notes), [notes]);

  useEffect(() => {
    if (!title && !content) {
      localStorage.removeItem(NOTE_DRAFT_KEY);
      return;
    }
    localStorage.setItem(NOTE_DRAFT_KEY, JSON.stringify({ title, content }));
  }, [title, content]);

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim() && attachments.length === 0) return;
    onAdd(title, content, attachments);
    setTitle("");
    setContent("");
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

  return (
    <section className="view-content" aria-label="笔记">
      <form
        className={isDragging ? "add-form note-form is-dragging" : "add-form note-form"}
        aria-label="笔记输入区"
        onSubmit={submitNote}
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
            id="notes-new-title"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder="笔记标题（可选）..."
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
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
            placeholder="写下笔记内容..."
            rows={5}
          />
          <ImageAttachments
            attachments={attachments}
            onChange={setAttachments}
            notice={attachmentNotice}
          />
          {isDragging && <p className="image-drop-hint">松开即可添加图片</p>}
        </div>
        <button type="submit" disabled={!content.trim() && attachments.length === 0}>
          添加笔记
        </button>
      </form>

      <div className="notes-heading">
        <h2>笔记</h2>
        <span>{query.trim() ? `找到 ${notes.length} / ${totalCount} 篇` : `共 ${totalCount} 篇`}</span>
      </div>

      <div className="content-scroll notes-scroll">
        {filteredNotes.length === 0 ? (
          <p className="empty">
            {query.trim() ? "没有找到匹配的笔记。" : "还没有笔记，把刚想到的内容记下来吧。"}
          </p>
        ) : (
          <ul className="notes-list">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onUpdate={onUpdate}
                onTogglePin={onTogglePin}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function NoteCard({
  note,
  onUpdate,
  onTogglePin,
  onDelete,
}: {
  note: Note;
  onUpdate: (noteId: string, title: string, content: string, attachments: ImageAttachment[]) => void;
  onTogglePin: (noteId: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [draftContent, setDraftContent] = useState(note.content);
  const [draftAttachments, setDraftAttachments] = useState<ImageAttachment[]>(note.attachments ?? []);
  const [attachmentNotice, setAttachmentNotice] = useState("");

  function startEditing() {
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setDraftAttachments(note.attachments ?? []);
    setAttachmentNotice("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setIsEditing(false);
  }

  function saveEditing() {
    if (!draftContent.trim()) return;
    onUpdate(note.id, draftTitle, draftContent, draftAttachments);
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
    <li className={isEditing ? "note-card editing" : "note-card"} onPaste={handlePaste}>
      {isEditing ? (
        <div className="note-edit-fields">
          <input
            className="edit-input"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelEditing();
            }}
            aria-label="笔记标题"
            autoFocus
          />
          <textarea
            className="edit-details"
            value={draftContent}
            onChange={(event) => setDraftContent(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelEditing();
            }}
            aria-label="笔记内容"
            rows={5}
          />
          <ImageAttachments
            attachments={draftAttachments}
            onChange={setDraftAttachments}
            notice={attachmentNotice}
          />
          <div className="note-actions">
            <button type="button" className="save-button" onClick={saveEditing} disabled={!draftContent.trim()}>
              保存
            </button>
            <button type="button" className="edit-button" onClick={cancelEditing}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="note-card-header">
            <h3>{note.title || "无标题笔记"}</h3>
            <div className="note-actions">
              <button
                type="button"
                className={note.pinned ? "pin-button active" : "pin-button"}
                onClick={() => onTogglePin(note.id)}
                aria-label={`${note.pinned ? "取消置顶" : "置顶"} ${note.title || "无标题笔记"}`}
                aria-pressed={note.pinned === true}
              >
                {note.pinned ? "已置顶" : "置顶"}
              </button>
              <button type="button" className="edit-button" onClick={startEditing}>
                编辑
              </button>
              <button type="button" className="delete-button" onClick={() => onDelete(note.id)}>
                删除
              </button>
            </div>
          </div>
          <p>{note.content}</p>
          <ImageAttachments attachments={note.attachments} />
        </>
      )}
    </li>
  );
}

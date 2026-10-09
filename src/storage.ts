import type { AppStateV2, ImageAttachment, LocalPlanBackupV1, Note, Task, TrashEntry } from "./types";
import {
  MAX_IMAGE_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DATA_URL_LENGTH,
} from "./attachments";

function normalizeProgress(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseLegacyTasks(raw: string | null, fallbackDate: string): Task[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): Task[] => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("id" in item) ||
        !("title" in item) ||
        typeof item.id !== "string" ||
        typeof item.title !== "string"
      ) {
        return [];
      }

      const record = item as Record<string, unknown>;
      const done = record.done === true;
      return [
        {
          id: item.id,
          title: item.title,
          details: typeof record.details === "string" ? record.details : "",
          progress:
            typeof record.progress === "number"
              ? normalizeProgress(record.progress)
              : done
                ? 100
                : 0,
          done,
          createdAt: typeof record.createdAt === "string" ? record.createdAt : fallbackDate,
          completedAt:
            typeof record.completedAt === "string" ? record.completedAt : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

function parseLegacyNotes(raw: string | null, fallbackDate: string): Note[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): Note[] => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("id" in item) ||
        !("title" in item) ||
        !("content" in item) ||
        typeof item.id !== "string" ||
        typeof item.title !== "string" ||
        typeof item.content !== "string"
      ) {
        return [];
      }

      const record = item as Record<string, unknown>;
      return [
        {
          id: item.id,
          title: item.title,
          content: item.content,
          createdAt: typeof record.createdAt === "string" ? record.createdAt : fallbackDate,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function migrateLegacyState(
  taskRaw: string | null,
  noteRaw: string | null,
  fallbackDate: string,
): AppStateV2 {
  return {
    version: 2,
    tasks: parseLegacyTasks(taskRaw, fallbackDate),
    notes: parseLegacyNotes(noteRaw, fallbackDate),
    trash: [],
  };
}

export function filterTasks(tasks: Task[], query: string): Task[] {
  const cleanQuery = query.trim().toLocaleLowerCase();
  if (!cleanQuery) return tasks;

  return tasks.filter(
    (task) =>
      task.title.toLocaleLowerCase().includes(cleanQuery) ||
      task.details.toLocaleLowerCase().includes(cleanQuery),
  );
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const cleanQuery = query.trim().toLocaleLowerCase();
  if (!cleanQuery) return notes;

  return notes.filter(
    (note) =>
      note.title.toLocaleLowerCase().includes(cleanQuery) ||
      note.content.toLocaleLowerCase().includes(cleanQuery),
  );
}

export function sortNotes(notes: Note[]): Note[] {
  return [
    ...notes.filter((note) => note.pinned === true),
    ...notes.filter((note) => note.pinned !== true),
  ];
}

export function searchAll(state: AppStateV2, query: string) {
  return {
    tasks: filterTasks(state.tasks, query),
    notes: filterNotes(state.notes, query),
  };
}

export function moveToTrash(
  state: AppStateV2,
  entityType: "task" | "note",
  entityId: string,
  deletedAt: string,
): AppStateV2 {
  if (entityType === "note") {
    const note = state.notes.find((item) => item.id === entityId);
    if (!note) return state;

    return {
      ...state,
      notes: state.notes.filter((item) => item.id !== entityId),
      trash: [{ entityType: "note", deletedAt, payload: note }, ...state.trash],
    };
  }

  const task = state.tasks.find((item) => item.id === entityId);
  if (!task) return state;

  return {
    ...state,
    tasks: state.tasks.filter((item) => item.id !== entityId),
    trash: [{ entityType: "task", deletedAt, payload: task }, ...state.trash],
  };
}

export function restoreFromTrash(
  state: AppStateV2,
  entityType: "task" | "note",
  entityId: string,
): AppStateV2 {
  if (entityType === "note") {
    const entry = state.trash.find(
      (item) => item.entityType === "note" && item.payload.id === entityId,
    );
    if (!entry || entry.entityType !== "note") return state;

    return {
      ...state,
      notes: [entry.payload, ...state.notes],
      trash: state.trash.filter(
        (item) => !(item.entityType === "note" && item.payload.id === entityId),
      ),
    };
  }

  const entry = state.trash.find(
    (item) => item.entityType === "task" && item.payload.id === entityId,
  );
  if (!entry || entry.entityType !== "task") return state;

  return {
    ...state,
    tasks: [entry.payload, ...state.tasks],
    trash: state.trash.filter(
      (item) => !(item.entityType === "task" && item.payload.id === entityId),
    ),
  };
}

export function permanentlyDeleteFromTrash(
  state: AppStateV2,
  entityType: "task" | "note",
  entityId: string,
): AppStateV2 {
  return {
    ...state,
    trash: state.trash.filter(
      (item) => !(item.entityType === entityType && item.payload.id === entityId),
    ),
  };
}

export function clearTrash(state: AppStateV2): AppStateV2 {
  return {
    ...state,
    trash: [],
  };
}

export function removeExpiredTrash(
  state: AppStateV2,
  now: string,
  retentionDays: number,
): AppStateV2 {
  const cutoff = new Date(now).getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return {
    ...state,
    trash: state.trash.filter((entry) => new Date(entry.deletedAt).getTime() > cutoff),
  };
}

export function serializeBackup(state: AppStateV2, exportedAt: string): string {
  const backup: LocalPlanBackupV1 = {
    format: "local-plan-backup",
    version: 1,
    exportedAt,
    data: state,
  };
  return JSON.stringify(backup, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isValidTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.title === "string" &&
    (value.title.trim().length > 0 || hasImageAttachments(value.attachments)) &&
    typeof value.details === "string" &&
    typeof value.progress === "number" &&
    Number.isFinite(value.progress) &&
    value.progress >= 0 &&
    value.progress <= 100 &&
    typeof value.done === "boolean" &&
    isIsoDate(value.createdAt) &&
    (value.completedAt === undefined || isIsoDate(value.completedAt)) &&
    isValidAttachments(value.attachments)
  );
}

function isValidNote(value: unknown): value is Note {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    (value.content.trim().length > 0 || hasImageAttachments(value.attachments)) &&
    isIsoDate(value.createdAt) &&
    (value.pinned === undefined || typeof value.pinned === "boolean") &&
    isValidAttachments(value.attachments)
  );
}

function isValidAttachments(value: unknown): value is ImageAttachment[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= MAX_IMAGE_ATTACHMENTS &&
      value.every(isValidImageAttachment))
  );
}

function hasImageAttachments(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && isValidAttachments(value);
}

function isValidImageAttachment(value: unknown): value is NonNullable<Task["attachments"]>[number] {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    typeof value.type === "string" &&
    value.type.startsWith("image/") &&
    typeof value.size === "number" &&
    Number.isFinite(value.size) &&
    value.size > 0 &&
    value.size <= MAX_IMAGE_BYTES &&
    typeof value.dataUrl === "string" &&
    value.dataUrl.startsWith("data:image/") &&
    value.dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH
  );
}

function isValidTrashEntry(value: unknown): value is TrashEntry {
  if (!isRecord(value) || !isIsoDate(value.deletedAt)) return false;
  if (value.entityType === "task") return isValidTask(value.payload);
  if (value.entityType === "note") return isValidNote(value.payload);
  return false;
}

function hasDuplicateItemIds(state: AppStateV2): boolean {
  const taskIds = [
    ...state.tasks.map((task) => task.id),
    ...state.trash
      .filter((item) => item.entityType === "task")
      .map((item) => item.payload.id),
  ];
  const noteIds = [
    ...state.notes.map((note) => note.id),
    ...state.trash
      .filter((item) => item.entityType === "note")
      .map((item) => item.payload.id),
  ];

  return new Set(taskIds).size !== taskIds.length || new Set(noteIds).size !== noteIds.length;
}

function isValidAppState(value: unknown): value is AppStateV2 {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.notes) ||
    !Array.isArray(value.trash) ||
    !value.tasks.every(isValidTask) ||
    !value.notes.every(isValidNote) ||
    !value.trash.every(isValidTrashEntry)
  ) {
    return false;
  }

  return !hasDuplicateItemIds(value as unknown as AppStateV2);
}

export function loadAppState(
  currentRaw: string | null,
  legacyTaskRaw: string | null,
  legacyNoteRaw: string | null,
  fallbackDate: string,
): AppStateV2 {
  if (currentRaw) {
    try {
      const parsed: unknown = JSON.parse(currentRaw);
      if (isValidAppState(parsed)) return parsed;
    } catch {
      // Fall through to legacy migration.
    }
  }

  return migrateLegacyState(legacyTaskRaw, legacyNoteRaw, fallbackDate);
}

export function parseBackup(raw: string): AppStateV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== "local-plan-backup" ||
    parsed.version !== 1 ||
    !isRecord(parsed.data) ||
    parsed.data.version !== 2 ||
    !Array.isArray(parsed.data.tasks) ||
    !Array.isArray(parsed.data.notes) ||
    !Array.isArray(parsed.data.trash)
  ) {
    throw new Error("Backup format is not supported.");
  }

  if (!isIsoDate(parsed.exportedAt)) {
    throw new Error("Backup export date is invalid.");
  }

  if (!parsed.data.tasks.every(isValidTask)) {
    throw new Error("Backup contains an invalid task.");
  }
  if (!parsed.data.notes.every(isValidNote)) {
    throw new Error("Backup contains an invalid note.");
  }
  if (!parsed.data.trash.every(isValidTrashEntry)) {
    throw new Error("Backup contains an invalid trash entry.");
  }

  const state = parsed.data as unknown as AppStateV2;
  if (hasDuplicateItemIds(state)) {
    throw new Error("Backup contains duplicate item IDs.");
  }

  return state;
}

export function previewBackup(raw: string) {
  const state = parseBackup(raw);
  const backup = JSON.parse(raw) as LocalPlanBackupV1;
  return {
    state,
    summary: {
      exportedAt: backup.exportedAt,
      taskCount: state.tasks.length,
      noteCount: state.notes.length,
      trashCount: state.trash.length,
    },
  };
}

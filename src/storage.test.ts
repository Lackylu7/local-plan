import { describe, expect, it } from "vitest";
import {
  clearTrash,
  filterNotes,
  filterTasks,
  loadAppState,
  migrateLegacyState,
  moveToTrash,
  parseBackup,
  permanentlyDeleteFromTrash,
  previewBackup,
  removeExpiredTrash,
  restoreFromTrash,
  searchAll,
  serializeBackup,
  sortNotes,
} from "./storage";
import { MAX_IMAGE_BYTES } from "./attachments";
import type { AppStateV2, Note, Task } from "./types";

describe("migrateLegacyState", () => {
  it("keeps valid legacy tasks when legacy notes are malformed", () => {
    const tasks = JSON.stringify([
      {
        id: "task-1",
        title: "Update resume",
        details: "Rewrite project results",
        progress: 45,
        done: false,
        createdAt: "2026-07-20T08:00:00.000Z",
      },
    ]);

    const state = migrateLegacyState(tasks, "not valid json", "2026-07-28T08:00:00.000Z");

    expect(state).toEqual({
      version: 2,
      tasks: [
        {
          id: "task-1",
          title: "Update resume",
          details: "Rewrite project results",
          progress: 45,
          done: false,
          createdAt: "2026-07-20T08:00:00.000Z",
          completedAt: undefined,
        },
      ],
      notes: [],
      trash: [],
    });
  });
});

describe("loadAppState", () => {
  it("prefers the current unified state over legacy collections", () => {
    const current: AppStateV2 = {
      version: 2,
      tasks: [],
      notes: [],
      trash: [
        {
          entityType: "note",
          deletedAt: "2026-07-28T09:00:00.000Z",
          payload: {
            id: "note-deleted",
            title: "Archived idea",
            content: "Keep this for later",
            createdAt: "2026-07-20T08:00:00.000Z",
          },
        },
      ],
    };
    const legacyTasks = JSON.stringify([
      {
        id: "legacy-task",
        title: "Legacy task",
        details: "",
        progress: 0,
        done: false,
        createdAt: "2026-07-19T08:00:00.000Z",
      },
    ]);

    expect(
      loadAppState(
        JSON.stringify(current),
        legacyTasks,
        null,
        "2026-07-28T08:00:00.000Z",
      ),
    ).toEqual(current);
  });

  it("falls back to legacy migration when the current state is invalid", () => {
    const invalidCurrent = JSON.stringify({
      version: 2,
      tasks: [
        {
          id: "broken-task",
          title: "Broken task",
          details: "",
          progress: 101,
          done: false,
          createdAt: "2026-07-20T08:00:00.000Z",
        },
      ],
      notes: [],
      trash: [],
    });
    const legacyNotes = JSON.stringify([
      {
        id: "legacy-note",
        title: "Legacy note",
        content: "Keep this note",
        createdAt: "2026-07-19T08:00:00.000Z",
      },
    ]);

    expect(
      loadAppState(invalidCurrent, null, legacyNotes, "2026-07-28T08:00:00.000Z"),
    ).toEqual({
      version: 2,
      tasks: [],
      notes: [
        {
          id: "legacy-note",
          title: "Legacy note",
          content: "Keep this note",
          createdAt: "2026-07-19T08:00:00.000Z",
        },
      ],
      trash: [],
    });
  });
});

describe("filterTasks", () => {
  it("matches task details without case sensitivity", () => {
    const tasks: Task[] = [
      {
        id: "task-1",
        title: "Update resume",
        details: "Rewrite PROJECT results",
        progress: 45,
        done: false,
        createdAt: "2026-07-20T08:00:00.000Z",
      },
      {
        id: "task-2",
        title: "Buy groceries",
        details: "Milk and fruit",
        progress: 0,
        done: false,
        createdAt: "2026-07-21T08:00:00.000Z",
      },
    ];

    expect(filterTasks(tasks, "  project ").map((task) => task.id)).toEqual(["task-1"]);
  });
});

describe("filterNotes", () => {
  it("matches note content without case sensitivity", () => {
    const notes: Note[] = [
      {
        id: "note-1",
        title: "Resume ideas",
        content: "Show measurable RESULTS",
        createdAt: "2026-07-20T08:00:00.000Z",
      },
      {
        id: "note-2",
        title: "Shopping list",
        content: "Milk and fruit",
        createdAt: "2026-07-21T08:00:00.000Z",
      },
    ];

    expect(filterNotes(notes, " results ").map((note) => note.id)).toEqual(["note-1"]);
  });
});

describe("searchAll", () => {
  it("uses one query across task details and note content", () => {
    const state: AppStateV2 = {
      version: 2,
      tasks: [
        {
          id: "task-match",
          title: "Prepare release",
          details: "Check deployment checklist",
          progress: 0,
          done: false,
          createdAt: "2026-07-20T08:00:00.000Z",
        },
        {
          id: "task-other",
          title: "Buy groceries",
          details: "Milk",
          progress: 0,
          done: false,
          createdAt: "2026-07-21T08:00:00.000Z",
        },
      ],
      notes: [
        {
          id: "note-match",
          title: "Release notes",
          content: "Deployment steps",
          createdAt: "2026-07-20T08:00:00.000Z",
        },
      ],
      trash: [],
    };

    const results = searchAll(state, " deployment ");

    expect(results.tasks.map((task) => task.id)).toEqual(["task-match"]);
    expect(results.notes.map((note) => note.id)).toEqual(["note-match"]);
  });
});

describe("sortNotes", () => {
  it("places pinned notes first without changing order within each group", () => {
    const notes = [
      {
        id: "note-a",
        title: "A",
        content: "First",
        createdAt: "2026-07-20T08:00:00.000Z",
      },
      {
        id: "note-b",
        title: "B",
        content: "Pinned first",
        createdAt: "2026-07-21T08:00:00.000Z",
        pinned: true,
      },
      {
        id: "note-c",
        title: "C",
        content: "Pinned second",
        createdAt: "2026-07-22T08:00:00.000Z",
        pinned: true,
      },
    ];

    expect(sortNotes(notes).map((note) => note.id)).toEqual([
      "note-b",
      "note-c",
      "note-a",
    ]);
  });
});

describe("moveToTrash", () => {
  it("moves a task with all of its fields and leaves notes unchanged", () => {
    const task: Task = {
      id: "task-1",
      title: "Update resume",
      details: "Rewrite project results",
      progress: 70,
      done: true,
      createdAt: "2026-07-20T08:00:00.000Z",
      completedAt: "2026-07-27T08:00:00.000Z",
    };
    const note: Note = {
      id: "note-1",
      title: "Resume ideas",
      content: "Show measurable results",
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const state: AppStateV2 = { version: 2, tasks: [task], notes: [note], trash: [] };

    expect(moveToTrash(state, "task", "task-1", "2026-07-28T08:00:00.000Z")).toEqual({
      version: 2,
      tasks: [],
      notes: [note],
      trash: [
        {
          entityType: "task",
          deletedAt: "2026-07-28T08:00:00.000Z",
          payload: task,
        },
      ],
    });
  });

  it("moves a note without changing tasks", () => {
    const task: Task = {
      id: "task-1",
      title: "Update resume",
      details: "",
      progress: 0,
      done: false,
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const note: Note = {
      id: "note-1",
      title: "Resume ideas",
      content: "Show measurable results",
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const state: AppStateV2 = { version: 2, tasks: [task], notes: [note], trash: [] };

    expect(moveToTrash(state, "note", "note-1", "2026-07-28T09:00:00.000Z")).toEqual({
      version: 2,
      tasks: [task],
      notes: [],
      trash: [
        {
          entityType: "note",
          deletedAt: "2026-07-28T09:00:00.000Z",
          payload: note,
        },
      ],
    });
  });
});

describe("restoreFromTrash", () => {
  it("restores a task to the top of the task list and removes its trash entry", () => {
    const restoredTask: Task = {
      id: "task-restored",
      title: "Update resume",
      details: "Rewrite project results",
      progress: 70,
      done: true,
      createdAt: "2026-07-20T08:00:00.000Z",
      completedAt: "2026-07-27T08:00:00.000Z",
    };
    const existingTask: Task = {
      id: "task-existing",
      title: "Buy groceries",
      details: "",
      progress: 0,
      done: false,
      createdAt: "2026-07-21T08:00:00.000Z",
    };
    const state: AppStateV2 = {
      version: 2,
      tasks: [existingTask],
      notes: [],
      trash: [
        {
          entityType: "task",
          deletedAt: "2026-07-28T08:00:00.000Z",
          payload: restoredTask,
        },
      ],
    };

    expect(restoreFromTrash(state, "task", "task-restored")).toEqual({
      version: 2,
      tasks: [restoredTask, existingTask],
      notes: [],
      trash: [],
    });
  });

  it("restores a note to the top of the note list", () => {
    const restoredNote: Note = {
      id: "note-restored",
      title: "Resume ideas",
      content: "Show measurable results",
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const existingNote: Note = {
      id: "note-existing",
      title: "Shopping list",
      content: "Milk and fruit",
      createdAt: "2026-07-21T08:00:00.000Z",
    };
    const state: AppStateV2 = {
      version: 2,
      tasks: [],
      notes: [existingNote],
      trash: [
        {
          entityType: "note",
          deletedAt: "2026-07-28T08:00:00.000Z",
          payload: restoredNote,
        },
      ],
    };

    expect(restoreFromTrash(state, "note", "note-restored")).toEqual({
      version: 2,
      tasks: [],
      notes: [restoredNote, existingNote],
      trash: [],
    });
  });
});

describe("permanentlyDeleteFromTrash", () => {
  it("removes only the selected trash entry", () => {
    const task: Task = {
      id: "task-1",
      title: "Update resume",
      details: "",
      progress: 0,
      done: false,
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const note: Note = {
      id: "note-1",
      title: "Resume ideas",
      content: "Show measurable results",
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const noteEntry = {
      entityType: "note" as const,
      deletedAt: "2026-07-28T09:00:00.000Z",
      payload: note,
    };
    const state: AppStateV2 = {
      version: 2,
      tasks: [],
      notes: [],
      trash: [
        {
          entityType: "task",
          deletedAt: "2026-07-28T08:00:00.000Z",
          payload: task,
        },
        noteEntry,
      ],
    };

    expect(permanentlyDeleteFromTrash(state, "task", "task-1").trash).toEqual([noteEntry]);
  });
});

describe("clearTrash", () => {
  it("removes every trash entry without changing active items", () => {
    const task: Task = {
      id: "task-1",
      title: "Update resume",
      details: "",
      progress: 0,
      done: false,
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const note: Note = {
      id: "note-1",
      title: "Resume ideas",
      content: "Show measurable results",
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const state: AppStateV2 = {
      version: 2,
      tasks: [task],
      notes: [note],
      trash: [
        {
          entityType: "task",
          deletedAt: "2026-07-28T08:00:00.000Z",
          payload: { ...task, id: "task-deleted" },
        },
      ],
    };

    expect(clearTrash(state)).toEqual({
      version: 2,
      tasks: [task],
      notes: [note],
      trash: [],
    });
  });
});

describe("removeExpiredTrash", () => {
  it("removes entries at least 30 days old and keeps newer entries", () => {
    const task: Task = {
      id: "task-old",
      title: "Old task",
      details: "",
      progress: 0,
      done: false,
      createdAt: "2026-06-01T08:00:00.000Z",
    };
    const note: Note = {
      id: "note-new",
      title: "Recent note",
      content: "Keep this",
      createdAt: "2026-07-01T08:00:00.000Z",
    };
    const state: AppStateV2 = {
      version: 2,
      tasks: [],
      notes: [],
      trash: [
        {
          entityType: "task",
          deletedAt: "2026-06-29T08:00:00.000Z",
          payload: task,
        },
        {
          entityType: "note",
          deletedAt: "2026-06-29T08:00:00.001Z",
          payload: note,
        },
      ],
    };

    expect(
      removeExpiredTrash(state, "2026-07-29T08:00:00.000Z", 30).trash.map(
        (entry) => entry.payload.id,
      ),
    ).toEqual(["note-new"]);
  });
});

describe("serializeBackup", () => {
  it("writes a versioned backup envelope around the complete app state", () => {
    const state: AppStateV2 = { version: 2, tasks: [], notes: [], trash: [] };

    expect(JSON.parse(serializeBackup(state, "2026-07-28T10:00:00.000Z"))).toEqual({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: state,
    });
  });
});

describe("parseBackup", () => {
  it("returns the complete app state from a valid backup", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [
          {
            id: "task-1",
            title: "Update resume",
            details: "Rewrite project results",
            progress: 45,
            done: false,
            createdAt: "2026-07-20T08:00:00.000Z",
          },
        ],
        notes: [],
        trash: [],
      },
    });

    expect(parseBackup(raw)).toEqual({
      version: 2,
      tasks: [
        {
          id: "task-1",
          title: "Update resume",
          details: "Rewrite project results",
          progress: 45,
          done: false,
          createdAt: "2026-07-20T08:00:00.000Z",
        },
      ],
      notes: [],
      trash: [],
    });
  });

  it("keeps valid image attachments in a backup", () => {
    const attachment = {
      id: "image-1",
      name: "screenshot.png",
      type: "image/png",
      size: 12,
      dataUrl: "data:image/png;base64,cG5n",
    };
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [
          {
            id: "task-1",
            title: "Review screenshot",
            details: "",
            progress: 0,
            done: false,
            createdAt: "2026-07-20T08:00:00.000Z",
            attachments: [attachment],
          },
        ],
        notes: [],
        trash: [],
      },
    });

    expect(parseBackup(raw).tasks[0]?.attachments).toEqual([attachment]);
  });

  it("rejects an image attachment over the local size limit", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [
          {
            id: "task-1",
            title: "Review screenshot",
            details: "",
            progress: 0,
            done: false,
            createdAt: "2026-07-20T08:00:00.000Z",
            attachments: [
              {
                id: "image-1",
                name: "huge.png",
                type: "image/png",
                size: MAX_IMAGE_BYTES + 1,
                dataUrl: "data:image/png;base64,cG5n",
              },
            ],
          },
        ],
        notes: [],
        trash: [],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid task.");
  });

  it("rejects a task whose progress is outside the supported range", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [
          {
            id: "task-1",
            title: "Update resume",
            details: "Rewrite project results",
            progress: 101,
            done: false,
            createdAt: "2026-07-20T08:00:00.000Z",
          },
        ],
        notes: [],
        trash: [],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid task.");
  });

  it("rejects a note that is missing required content", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [],
        notes: [
          {
            id: "note-1",
            title: "Resume ideas",
            createdAt: "2026-07-20T08:00:00.000Z",
          },
        ],
        trash: [],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid note.");
  });

  it("rejects a task with an invalid creation date", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [
          {
            id: "task-1",
            title: "Update resume",
            details: "",
            progress: 0,
            done: false,
            createdAt: "not-a-date",
          },
        ],
        notes: [],
        trash: [],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid task.");
  });

  it("rejects a note with an invalid creation date", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [],
        notes: [
          {
            id: "note-1",
            title: "Resume ideas",
            content: "Show measurable results",
            createdAt: "not-a-date",
          },
        ],
        trash: [],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid note.");
  });

  it("rejects a trash entry whose payload does not match its entity type", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [],
        notes: [],
        trash: [
          {
            entityType: "task",
            deletedAt: "2026-07-28T09:00:00.000Z",
            payload: {
              id: "note-1",
              title: "Resume ideas",
              content: "Show measurable results",
              createdAt: "2026-07-20T08:00:00.000Z",
            },
          },
        ],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid trash entry.");
  });

  it("rejects a trash entry with an invalid deletion date", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [],
        notes: [],
        trash: [
          {
            entityType: "note",
            deletedAt: "not-a-date",
            payload: {
              id: "note-1",
              title: "Resume ideas",
              content: "Show measurable results",
              createdAt: "2026-07-20T08:00:00.000Z",
            },
          },
        ],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid trash entry.");
  });

  it("rejects duplicate task IDs across active tasks and trash", () => {
    const task = {
      id: "task-1",
      title: "Update resume",
      details: "",
      progress: 0,
      done: false,
      createdAt: "2026-07-20T08:00:00.000Z",
    };
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [task],
        notes: [],
        trash: [
          {
            entityType: "task",
            deletedAt: "2026-07-28T09:00:00.000Z",
            payload: task,
          },
        ],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains duplicate item IDs.");
  });

  it("rejects a task with a blank required title", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [
          {
            id: "task-1",
            title: "   ",
            details: "",
            progress: 0,
            done: false,
            createdAt: "2026-07-20T08:00:00.000Z",
          },
        ],
        notes: [],
        trash: [],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid task.");
  });

  it("rejects a note with blank required content", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [],
        notes: [
          {
            id: "note-1",
            title: "Resume ideas",
            content: "   ",
            createdAt: "2026-07-20T08:00:00.000Z",
          },
        ],
        trash: [],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup contains an invalid note.");
  });

  it("accepts a note with an optional blank title", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "2026-07-28T10:00:00.000Z",
      data: {
        version: 2,
        tasks: [],
        notes: [
          {
            id: "note-1",
            title: "",
            content: "Keep the content",
            createdAt: "2026-07-20T08:00:00.000Z",
          },
        ],
        trash: [],
      },
    });

    expect(parseBackup(raw).notes[0]?.title).toBe("");
  });

  it("rejects an invalid backup export date", () => {
    const raw = JSON.stringify({
      format: "local-plan-backup",
      version: 1,
      exportedAt: "not-a-date",
      data: {
        version: 2,
        tasks: [],
        notes: [],
        trash: [],
      },
    });

    expect(() => parseBackup(raw)).toThrow("Backup export date is invalid.");
  });
});

describe("previewBackup", () => {
  it("returns the validated backup date and item counts before import", () => {
    const state: AppStateV2 = {
      version: 2,
      tasks: [
        {
          id: "task-1",
          title: "Prepare release",
          details: "",
          progress: 20,
          done: false,
          createdAt: "2026-07-20T08:00:00.000Z",
        },
      ],
      notes: [
        {
          id: "note-1",
          title: "Release notes",
          content: "Draft",
          createdAt: "2026-07-21T08:00:00.000Z",
        },
      ],
      trash: [
        {
          entityType: "note",
          deletedAt: "2026-07-28T08:00:00.000Z",
          payload: {
            id: "note-deleted",
            title: "Old note",
            content: "Archived",
            createdAt: "2026-07-19T08:00:00.000Z",
          },
        },
      ],
    };

    expect(
      previewBackup(serializeBackup(state, "2026-07-29T04:00:00.000Z")).summary,
    ).toEqual({
      exportedAt: "2026-07-29T04:00:00.000Z",
      taskCount: 1,
      noteCount: 1,
      trashCount: 1,
    });
  });
});

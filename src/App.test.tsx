// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { serializeBackup } from "./storage";
import type { AppStateV2 } from "./types";

const APP_STATE_KEY = "local-plan-state-v2";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete window.localPlanBackup;
});

describe("task deletion", () => {
  it("moves a task to trash without confirmation and lets the user undo", async () => {
    const state: AppStateV2 = {
      version: 2,
      tasks: [
        {
          id: "task-1",
          title: "Prepare release",
          details: "Check the package",
          progress: 0,
          done: false,
          createdAt: "2026-07-29T04:00:00.000Z",
        },
      ],
      notes: [],
      trash: [],
    };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "撤销删除" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "撤销删除" }));
    expect(screen.getByText("Prepare release")).toBeTruthy();
  });

  it("moves completed tasks to trash without confirmation and restores them together", async () => {
    const state: AppStateV2 = {
      version: 2,
      tasks: [
        {
          id: "task-1",
          title: "First completed task",
          details: "",
          progress: 100,
          done: true,
          createdAt: "2026-07-29T04:00:00.000Z",
          completedAt: "2026-07-29T05:00:00.000Z",
        },
        {
          id: "task-2",
          title: "Second completed task",
          details: "",
          progress: 100,
          done: true,
          createdAt: "2026-07-29T04:01:00.000Z",
          completedAt: "2026-07-29T05:01:00.000Z",
        },
      ],
      notes: [],
      trash: [],
    };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "移入回收站" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByText("First completed task")).toBeNull();

    await user.click(screen.getByRole("button", { name: "撤销删除" }));
    expect(screen.getByText("First completed task")).toBeTruthy();
    expect(screen.getByText("Second completed task")).toBeTruthy();
  });
});

describe("note creation", () => {
  it("allows saving a note without a title", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    await user.type(screen.getByPlaceholderText("写下笔记内容..."), "Remember this");

    const addButton = screen.getByRole("button", { name: "添加笔记" }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    await user.click(addButton);

    expect(screen.getByRole("heading", { name: "无标题笔记" })).toBeTruthy();
  });

  it("moves a pinned note to the top of the note list", async () => {
    const state: AppStateV2 = {
      version: 2,
      tasks: [],
      notes: [
        {
          id: "note-a",
          title: "A",
          content: "First",
          createdAt: "2026-07-29T04:00:00.000Z",
        },
        {
          id: "note-b",
          title: "B",
          content: "Second",
          createdAt: "2026-07-29T04:01:00.000Z",
        },
      ],
      trash: [],
    };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    await user.click(screen.getByRole("button", { name: "置顶 B" }));

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["B", "A"]);
  });

  it("restores an unfinished note draft after reopening the app", async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);
    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    await user.type(screen.getByPlaceholderText("笔记标题（可选）..."), "Draft title");
    await user.type(screen.getByPlaceholderText("写下笔记内容..."), "Draft content");

    firstRender.unmount();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: /笔记/ }));

    expect(
      (screen.getByPlaceholderText("笔记标题（可选）...") as HTMLInputElement).value,
    ).toBe("Draft title");
    expect(
      (screen.getByPlaceholderText("写下笔记内容...") as HTMLTextAreaElement).value,
    ).toBe("Draft content");
  });
});

describe("quick add with Enter", () => {
  it("adds a task when Enter is pressed in the details field", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText("输入一个任务..."), "Keyboard task");
    const details = screen.getByPlaceholderText("补充小任务 / 备注，可一行一个...");
    await user.type(details, "Keyboard details");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Keyboard task")).toBeTruthy();
    expect(screen.getByText("Keyboard details")).toBeTruthy();
  });

  it("adds a note when Enter is pressed in the content field", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    const content = screen.getByPlaceholderText("写下笔记内容...");
    await user.type(content, "Keyboard note");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { name: "无标题笔记" })).toBeTruthy();
    expect(screen.getByText("Keyboard note")).toBeTruthy();
  });

  it("keeps Shift+Enter available for line breaks", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    const content = screen.getByPlaceholderText("写下笔记内容...") as HTMLTextAreaElement;
    await user.type(content, "First line");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(content, "Second line");

    expect(content.value).toBe("First line\nSecond line");
    expect(screen.queryByRole("heading", { name: "无标题笔记" })).toBeNull();
  });
});

describe("image attachments", () => {
  it("opens a task image in a larger preview and closes it with Escape", async () => {
    const attachment = {
      id: "image-1",
      name: "task-preview.png",
      type: "image/png",
      size: 12,
      dataUrl: "data:image/png;base64,preview",
    };
    localStorage.setItem(
      APP_STATE_KEY,
      JSON.stringify({
        version: 2,
        tasks: [{ id: "task-1", title: "带截图的任务", details: "", progress: 0, done: false, createdAt: "2026-07-29T04:00:00.000Z", attachments: [attachment] }],
        notes: [],
        trash: [],
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "放大图片 task-preview.png" }));
    expect(screen.getByRole("dialog", { name: "图片预览：task-preview.png" })).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "task-preview.png" })).toHaveLength(2);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "图片预览：task-preview.png" })).toBeNull();
  });

  it("accepts a pasted screenshot in a task input and persists it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const image = new File(["png-data"], "screenshot.png", { type: "image/png" });
    const title = screen.getByPlaceholderText("输入一个任务...");

    fireEvent.paste(title, {
      clipboardData: { files: [image] },
    });
    expect(await screen.findByRole("img", { name: "screenshot.png" })).toBeTruthy();

    await user.type(title, "带截图的任务");
    await user.click(screen.getByRole("button", { name: "添加" }));

    const saved = JSON.parse(localStorage.getItem(APP_STATE_KEY) || "{}");
    expect(saved.tasks[0].attachments).toHaveLength(1);
    expect(saved.tasks[0].attachments[0].name).toBe("screenshot.png");
  });

  it("attaches a dropped image to a task and persists it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const image = new File(["dropped-png-data"], "dropped-screenshot.png", {
      type: "image/png",
    });

    fireEvent.drop(screen.getByPlaceholderText("输入一个任务..."), {
      dataTransfer: { files: [image] },
    });
    expect(await screen.findByRole("img", { name: "dropped-screenshot.png" })).toBeTruthy();

    await user.type(screen.getByPlaceholderText("输入一个任务..."), "拖入截图的任务");
    await user.click(screen.getByRole("button", { name: "添加" }));

    const saved = JSON.parse(localStorage.getItem(APP_STATE_KEY) || "{}");
    expect(saved.tasks[0].attachments).toHaveLength(1);
    expect(saved.tasks[0].attachments[0].name).toBe("dropped-screenshot.png");
  });

  it("saves a task that contains only an image", async () => {
    const user = userEvent.setup();
    render(<App />);
    const image = new File(["image-only-task"], "task-only.png", { type: "image/png" });

    fireEvent.drop(screen.getByPlaceholderText("输入一个任务..."), {
      dataTransfer: { files: [image] },
    });
    await screen.findByRole("img", { name: "task-only.png" });

    const addButton = screen.getByRole("button", { name: "添加" }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    await user.click(addButton);

    const saved = JSON.parse(localStorage.getItem(APP_STATE_KEY) || "{}");
    expect(saved.tasks).toHaveLength(1);
    expect(saved.tasks[0].title).toBe("");
    expect(saved.tasks[0].attachments[0].name).toBe("task-only.png");

    cleanup();
    render(<App />);
    expect(screen.getByRole("img", { name: "task-only.png" })).toBeTruthy();
  });

  it("shows feedback while an image is dragged over the attachment area", () => {
    render(<App />);
    const image = new File(["preview-data"], "preview.png", { type: "image/png" });
    const dropZone = screen.getByPlaceholderText("输入一个任务...");

    fireEvent.dragEnter(dropZone, {
      dataTransfer: { files: [image], types: ["Files"] },
    });

    expect(screen.getByText("松开即可添加图片")).toBeTruthy();
  });

  it("does not show a separate add-image control", () => {
    render(<App />);

    expect(screen.queryByRole("button", { name: "添加图片" })).toBeNull();
    expect(screen.queryByText("可拖入或粘贴截图，最多 3 张")).toBeNull();
  });

  it("accepts a pasted screenshot in a note", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    const image = new File(["jpg-data"], "pasted.jpg", { type: "image/jpeg" });
    const content = screen.getByPlaceholderText("写下笔记内容...");

    fireEvent.paste(content, {
      clipboardData: { files: [image] },
    });

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "pasted.jpg" })).toBeTruthy();
    });
    await user.type(content, "会议截图");
    await user.click(screen.getByRole("button", { name: "添加笔记" }));

    const saved = JSON.parse(localStorage.getItem(APP_STATE_KEY) || "{}");
    expect(saved.notes[0].attachments).toHaveLength(1);
    expect(saved.notes[0].attachments[0].name).toBe("pasted.jpg");
  });

  it("accepts a dropped screenshot in a note input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    const image = new File(["dropped-jpg-data"], "note-drop.jpg", { type: "image/jpeg" });
    const content = screen.getByPlaceholderText("写下笔记内容...");

    fireEvent.drop(content, {
      dataTransfer: { files: [image] },
    });

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "note-drop.jpg" })).toBeTruthy();
    });
    await user.type(content, "拖入截图的笔记");
    await user.click(screen.getByRole("button", { name: "添加笔记" }));

    const saved = JSON.parse(localStorage.getItem(APP_STATE_KEY) || "{}");
    expect(saved.notes[0].attachments[0].name).toBe("note-drop.jpg");
  });

  it("saves a note that contains only an image", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    const image = new File(["image-only-note"], "note-only.jpg", { type: "image/jpeg" });
    const content = screen.getByPlaceholderText("写下笔记内容...");

    fireEvent.drop(content, {
      dataTransfer: { files: [image] },
    });
    await screen.findByRole("img", { name: "note-only.jpg" });

    const addButton = screen.getByRole("button", { name: "添加笔记" }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    await user.click(addButton);

    const saved = JSON.parse(localStorage.getItem(APP_STATE_KEY) || "{}");
    expect(saved.notes).toHaveLength(1);
    expect(saved.notes[0].content).toBe("");
    expect(saved.notes[0].attachments[0].name).toBe("note-only.jpg");

    cleanup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    expect(screen.getByRole("img", { name: "note-only.jpg" })).toBeTruthy();
  });
});

describe("startup focus", () => {
  it("returns to the task input when the app window is activated", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    await user.click(screen.getByRole("searchbox", { name: "搜索任务和笔记" }));
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /任务/ }).getAttribute("aria-selected")).toBe("true");
      expect(document.activeElement).toBe(screen.getByPlaceholderText("输入一个任务..."));
    });
  });
});

describe("global search", () => {
  it("keeps one query active across task and note views", async () => {
    const state: AppStateV2 = {
      version: 2,
      tasks: [
        {
          id: "task-1",
          title: "Deploy app",
          details: "Production",
          progress: 0,
          done: false,
          createdAt: "2026-07-29T04:00:00.000Z",
        },
      ],
      notes: [
        {
          id: "note-1",
          title: "Deployment checklist",
          content: "Verify backup",
          createdAt: "2026-07-29T04:01:00.000Z",
        },
      ],
      trash: [],
    };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    const user = userEvent.setup();
    render(<App />);

    const search = screen.getByRole("searchbox", {
      name: "搜索任务和笔记",
    }) as HTMLInputElement;
    await user.type(search, "deploy");
    expect(screen.getByText("Deploy app")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    expect(screen.getByText("Deployment checklist")).toBeTruthy();
    expect(search.value).toBe("deploy");
  });

  it("focuses search and the current view add form from keyboard shortcuts", async () => {
    const user = userEvent.setup();
    render(<App />);

    const search = screen.getByRole("searchbox", { name: "搜索任务和笔记" });
    await user.keyboard("{Control>}f{/Control}");
    expect(document.activeElement).toBe(search);

    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    await user.keyboard("{Control>}n{/Control}");
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("笔记标题（可选）..."),
    );
  });

  it("clears the focused search with Escape", async () => {
    const user = userEvent.setup();
    render(<App />);

    const search = screen.getByRole("searchbox", {
      name: "搜索任务和笔记",
    }) as HTMLInputElement;
    await user.type(search, "release");
    await user.keyboard("{Escape}");

    expect(search.value).toBe("");
  });
});

describe("backup import", () => {
  it("previews validated backup counts before replacing current data", async () => {
    const imported: AppStateV2 = {
      version: 2,
      tasks: [
        {
          id: "task-imported",
          title: "Imported task",
          details: "",
          progress: 0,
          done: false,
          createdAt: "2026-07-20T08:00:00.000Z",
        },
      ],
      notes: [
        {
          id: "note-imported",
          title: "Imported note",
          content: "Content",
          createdAt: "2026-07-20T08:00:00.000Z",
        },
      ],
      trash: [
        {
          entityType: "note",
          deletedAt: "2026-07-28T08:00:00.000Z",
          payload: {
            id: "note-deleted",
            title: "Deleted note",
            content: "Archived",
            createdAt: "2026-07-19T08:00:00.000Z",
          },
        },
      ],
    };
    window.localPlanBackup = {
      exportBackup: vi.fn(),
      importBackup: vi.fn().mockResolvedValue({
        status: "selected",
        content: serializeBackup(imported, "2026-07-29T04:00:00.000Z"),
        path: "backup.json",
      }),
    };
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "数据" }));
    await user.click(screen.getByRole("button", { name: "导入备份" }));

    const dialog = await screen.findByRole("dialog", { name: "导入备份预览" });
    expect(dialog.textContent).toContain("任务 1");
    expect(dialog.textContent).toContain("笔记 1");
    expect(dialog.textContent).toContain("回收站 1");
    expect(dialog.textContent).toContain("2026/07/29");
    expect(confirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认导入" }));
    expect(screen.getByText("Imported task")).toBeTruthy();
  });

  it("writes an automatic backup and shows the latest backup time", async () => {
    vi.useFakeTimers();
    const autoBackup = vi.fn().mockResolvedValue({
      status: "saved",
      path: "auto-backup.json",
      savedAt: "2026-07-29T04:05:00.000Z",
    });
    window.localPlanBackup = {
      exportBackup: vi.fn(),
      importBackup: vi.fn(),
      autoBackup,
    };
    render(<App />);

    await vi.advanceTimersByTimeAsync(1000);
    expect(autoBackup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "数据" }));
    expect(screen.getByText(/最近自动备份/).textContent).toContain("2026/07/29");
  });

  it("closes the import preview with Escape without replacing current data", async () => {
    const imported: AppStateV2 = {
      version: 2,
      tasks: [
        {
          id: "task-imported",
          title: "Imported task",
          details: "",
          progress: 0,
          done: false,
          createdAt: "2026-07-20T08:00:00.000Z",
        },
      ],
      notes: [],
      trash: [],
    };
    window.localPlanBackup = {
      exportBackup: vi.fn(),
      importBackup: vi.fn().mockResolvedValue({
        status: "selected",
        content: serializeBackup(imported, "2026-07-29T04:00:00.000Z"),
        path: "backup.json",
      }),
    };
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "数据" }));
    await user.click(screen.getByRole("button", { name: "导入备份" }));
    expect(await screen.findByRole("dialog", { name: "导入备份预览" })).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "导入备份预览" })).toBeNull();
    expect(screen.queryByText("Imported task")).toBeNull();
  });
});

describe("editing dismissal", () => {
  const state: AppStateV2 = {
    version: 2,
    tasks: [
      {
        id: "task-1",
        title: "Original task",
        details: "Original details",
        progress: 0,
        done: false,
        createdAt: "2026-07-29T04:00:00.000Z",
      },
    ],
    notes: [
      {
        id: "note-1",
        title: "Original note",
        content: "Original content",
        createdAt: "2026-07-29T04:01:00.000Z",
      },
    ],
    trash: [],
  };

  it("cancels task editing with Escape", async () => {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "编辑" }));
    const title = screen.getByDisplayValue("Original task") as HTMLInputElement;
    await user.clear(title);
    await user.type(title, "Changed task");
    await user.keyboard("{Escape}");

    expect(screen.getByText("Original task")).toBeTruthy();
    expect(screen.queryByDisplayValue("Changed task")).toBeNull();
  });

  it("cancels note editing with Escape", async () => {
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: /笔记/ }));
    await user.click(screen.getByRole("button", { name: "编辑" }));
    const content = screen.getByRole("textbox", { name: "笔记内容" }) as HTMLTextAreaElement;
    await user.clear(content);
    await user.type(content, "Changed content");
    await user.keyboard("{Escape}");

    expect(screen.getByText("Original content")).toBeTruthy();
    expect(screen.queryByDisplayValue("Changed content")).toBeNull();
  });
});

describe("trash retention", () => {
  it("removes expired trash after the user enables 30-day cleanup", async () => {
    const state: AppStateV2 = {
      version: 2,
      tasks: [],
      notes: [],
      trash: [
        {
          entityType: "note",
          deletedAt: "2020-01-01T00:00:00.000Z",
          payload: {
            id: "note-old",
            title: "Old note",
            content: "Expired",
            createdAt: "2019-12-01T00:00:00.000Z",
          },
        },
      ],
    };
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "数据" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "自动清理 30 天前的回收站项目",
      }),
    );
    await user.click(screen.getByRole("tab", { name: /回收站/ }));

    expect(screen.getByText("回收站是空的。")).toBeTruthy();
    expect(localStorage.getItem("local-plan-auto-cleanup-v1")).toBe("true");
  });
});

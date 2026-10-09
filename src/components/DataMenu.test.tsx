// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataMenu } from "./DataMenu";

afterEach(cleanup);

describe("DataMenu", () => {
  it("closes on outside click, Escape, and view changes", async () => {
    const user = userEvent.setup();
    const props = {
      busy: false,
      notice: "",
      closeKey: "tasks",
      autoCleanupEnabled: false,
      onAutoCleanupChange: vi.fn(),
      lastBackupAt: "",
      onExport: vi.fn(),
      onImport: vi.fn(),
    };
    const view = render(<DataMenu {...props} />);
    const trigger = screen.getByRole("button", { name: "数据" });

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await user.click(document.body);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);
    view.rerender(<DataMenu {...props} closeKey="notes" />);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

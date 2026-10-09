import { describe, expect, it } from "vitest";

describe("selectBackupFilesToDelete", () => {
  it("keeps the seven newest backups regardless of input order", async () => {
    const { selectBackupFilesToDelete } = await import("../electron/backup-policy.js");
    const files = [
      { name: "backup-04.json", modifiedAt: 4 },
      { name: "backup-08.json", modifiedAt: 8 },
      { name: "backup-01.json", modifiedAt: 1 },
      { name: "backup-06.json", modifiedAt: 6 },
      { name: "backup-03.json", modifiedAt: 3 },
      { name: "backup-09.json", modifiedAt: 9 },
      { name: "backup-07.json", modifiedAt: 7 },
      { name: "backup-02.json", modifiedAt: 2 },
      { name: "backup-05.json", modifiedAt: 5 },
    ];

    expect(selectBackupFilesToDelete(files, 7)).toEqual([
      "backup-02.json",
      "backup-01.json",
    ]);
  });
});

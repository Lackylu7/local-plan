export interface BackupFileInfo {
  name: string;
  modifiedAt: number;
}

export function selectBackupFilesToDelete(
  files: BackupFileInfo[],
  keepCount: number,
): string[];

export function selectBackupFilesToDelete(files, keepCount) {
  return [...files]
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .slice(Math.max(0, keepCount))
    .map((file) => file.name);
}

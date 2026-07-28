# Local Plan Search, Trash, Editing, and Backup Design

## Goal

Improve Local Plan's everyday reliability without turning it into a complex planning system. The release adds note editing, page-local search, recoverable deletion, and full data backup while preserving the current lightweight desktop workflow.

## Scope

### Included

- Edit existing note titles and content with save and cancel actions.
- Search tasks within the Tasks view and notes within the Notes view.
- Move deleted tasks and notes into a shared Trash view.
- Restore items, permanently delete individual items, or empty Trash.
- Export and import a versioned JSON backup containing tasks, notes, and Trash.
- Migrate existing locally stored tasks and notes without data loss.

### Excluded

- Categories, reminders, due dates, preset tasks, cloud sync, and accounts.
- Cross-view search results that mix tasks and notes.
- Merging imported data with current data.
- Backing up device-specific UI settings such as floating-button visibility or position.

## User Interface

The existing top navigation becomes a three-part segmented control: Tasks, Notes, and Trash. Each tab displays its item count. The header keeps the floating-button control and gains a compact Data menu with Export Backup and Import Backup actions.

The Tasks and Notes views each have their own search input. Search filters only the current view and matches all meaningful text fields. An empty collection and a search with no matches use different messages so the user can tell whether data exists.

Note cards gain an Edit action. Editing happens inside the card and mirrors task editing: the user can save valid changes or cancel and keep the original note. A note title and body are both required.

Trash displays deleted tasks and notes in one list. Each row has a clear type label, title, short content preview, deletion time, Restore, and Permanently Delete actions. Empty Trash is available at the section level. Permanent deletion and emptying Trash require confirmation.

## Data Model

Application content is stored as one versioned state object:

```ts
interface AppStateV2 {
  version: 2;
  tasks: Task[];
  notes: Note[];
  trash: TrashEntry[];
}

interface TrashEntry {
  entityType: "task" | "note";
  deletedAt: string;
  payload: Task | Note;
}
```

Task and note payloads retain their original IDs and all fields. Active and trashed items of the same type must not share an ID. Restoring an item removes it from Trash and returns the unchanged payload to the top of its original list.

On first launch after the upgrade, the storage layer reads and normalizes the existing task and note keys independently, creates an empty Trash array, and writes `AppStateV2`. If one legacy collection is malformed, the valid collection is still migrated. The old keys remain untouched as a fallback but are no longer updated.

## Search Behavior

Search is case-insensitive and trims surrounding whitespace.

- Tasks: match title or details.
- Notes: match title or content.
- Empty query: show the complete current view.
- Search never changes stored data or item ordering.

## Deletion and Recovery

Deleting an active task or note moves it into Trash instead of discarding it. Completed and in-progress task fields remain intact. Restoring returns the item to its original collection. Permanently deleting an item removes only that Trash entry. Empty Trash removes all Trash entries after a separate confirmation.

All destructive confirmation text names the action clearly. Cancelling any confirmation leaves state unchanged.

## Backup Format and File Flow

Exports use a versioned JSON envelope:

```ts
interface LocalPlanBackupV1 {
  format: "local-plan-backup";
  version: 1;
  exportedAt: string;
  data: AppStateV2;
}
```

Export uses a native Windows Save dialog with a suggested filename such as `local-plan-backup-2026-07-28.json`. Import uses a native Open dialog restricted to JSON files. Electron's main process performs file reads and writes; the preload bridge exposes only narrow backup methods to the renderer.

The renderer parses and validates the entire import before showing an overwrite confirmation. Validation checks the format marker, supported versions, array shapes, required fields, progress bounds, date strings, entity types, and duplicate IDs. Invalid or unsupported files produce an error message and never alter current data. A valid import replaces tasks, notes, and Trash together. Cancelling file selection or overwrite confirmation is a no-op.

## Code Organization

- `src/App.tsx`: application navigation, top-level state, and coordination.
- `src/types.ts`: shared task, note, Trash, app-state, and backup types.
- `src/storage.ts`: migration, normalization, persistence, backup serialization, and import validation.
- `src/components/TaskView.tsx`: task creation, editing, progress, search, completion, and deletion.
- `src/components/NotesView.tsx`: note creation, editing, search, and deletion.
- `src/components/TrashView.tsx`: restore, permanent deletion, and empty-Trash UI.
- `src/components/DataMenu.tsx`: export/import actions and operation feedback.
- `electron/main.cjs` and `electron/preload.cjs`: native file dialogs and constrained IPC.

The split is limited to responsibilities introduced or materially expanded by this release. Existing visual conventions, local helpers, and Electron security settings remain in place. No new production dependency is required.

## Error Handling

- Storage migration handles tasks and notes independently; an invalid legacy collection becomes empty without discarding the other valid collection.
- A failed backup write reports an error and does not modify application data.
- A failed read, parse, or validation reports the reason at a user-friendly level and preserves current data.
- Import updates the in-memory state only after full validation and overwrite confirmation.
- Disabled save actions prevent blank note titles or bodies.

## Verification

Focused automated tests cover migration, search matching, moving and restoring both entity types, permanent deletion, backup serialization, valid import replacement, and rejection of malformed or unsupported backups. Vitest is added as a development-only dependency for these pure-function tests.

The complete application is then verified with:

- TypeScript and Vite production build.
- Electron interaction checks for all three tabs, note editing, search empty states, Trash actions, and import/export cancellation.
- A backup round trip that exports known data and imports it over changed data.
- A malformed backup test proving current data remains unchanged.
- Windows packaging and launch verification at the existing default window size.
- Desktop and narrow-window visual checks for overflow, button stability, scrolling, focus, hover, active, and empty states.

## Acceptance Criteria

- Existing users see all previous tasks and notes after upgrading.
- Notes can be edited without recreating them.
- Search reliably filters only the active Tasks or Notes view.
- Deleted items remain recoverable until permanently removed from Trash.
- A valid exported backup restores tasks, notes, and Trash exactly.
- Invalid imports cannot overwrite current data.
- The new controls remain clear and usable without changing Local Plan into a category, reminder, or scheduling tool.

export interface ImageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface Task {
  id: string;
  title: string;
  details: string;
  progress: number;
  done: boolean;
  createdAt: string;
  completedAt?: string;
  attachments?: ImageAttachment[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  pinned?: boolean;
  attachments?: ImageAttachment[];
}

export type TrashEntry =
  | {
      entityType: "task";
      deletedAt: string;
      payload: Task;
    }
  | {
      entityType: "note";
      deletedAt: string;
      payload: Note;
    };

export interface AppStateV2 {
  version: 2;
  tasks: Task[];
  notes: Note[];
  trash: TrashEntry[];
}

export interface LocalPlanBackupV1 {
  format: "local-plan-backup";
  version: 1;
  exportedAt: string;
  data: AppStateV2;
}

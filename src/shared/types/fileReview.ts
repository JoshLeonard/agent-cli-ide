import type { ActivityType } from './activity';

export type FileChangeType = 'created' | 'modified' | 'deleted';

export interface PendingFileChange {
  id: string;
  sessionId: string;
  filePath: string;
  changeType: FileChangeType;
  timestamp: number;
  reviewed: boolean;
}

export interface FileDiff {
  filePath: string;
  originalContent: string | null; // null for new files
  modifiedContent: string | null; // null for deleted files
  language: string;
  changeType: FileChangeType;
}

export interface FileReviewRequest {
  sessionId: string;
  filePath: string;
}

export interface FileReviewResult {
  success: boolean;
  diff?: FileDiff;
  error?: string;
}

export interface FileSaveRequest {
  sessionId: string;
  filePath: string;
  content: string;
}

export interface FileSaveResult {
  success: boolean;
  error?: string;
}

export interface FileRevertRequest {
  sessionId: string;
  filePath: string;
}

export interface FileRevertResult {
  success: boolean;
  error?: string;
}

// Map ActivityType to FileChangeType
export function activityTypeToFileChangeType(type: ActivityType): FileChangeType | null {
  switch (type) {
    case 'file_created':
      return 'created';
    case 'file_modified':
      return 'modified';
    case 'file_deleted':
      return 'deleted';
    default:
      return null;
  }
}

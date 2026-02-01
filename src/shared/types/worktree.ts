export interface WorktreeResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

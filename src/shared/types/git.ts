// Git file status codes (matching git status --porcelain)
export type GitFileStatus =
  | 'M'   // Modified
  | 'A'   // Added (staged)
  | 'D'   // Deleted
  | 'R'   // Renamed
  | 'C'   // Copied
  | 'U'   // Unmerged (conflict)
  | '?'   // Untracked
  | '!'   // Ignored
  | 'T'   // Type changed
  | ' ';  // Unmodified

export interface GitStatusFile {
  path: string;
  indexStatus: GitFileStatus;    // Status in staging area
  workTreeStatus: GitFileStatus; // Status in working tree
  originalPath?: string;         // For renames/copies
  isStaged: boolean;
  isUntracked: boolean;
  hasConflict: boolean;
}

export interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  files: GitStatusFile[];
  hasConflicts: boolean;
  stashCount: number;
  isClean: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
  ahead: number;
  behind: number;
  lastCommit?: string;
  lastCommitDate?: number;
}

export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface GitCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  body?: string;
  author: string;
  authorEmail: string;
  date: number;
  parents: string[];
}

export interface GitLogEntry extends GitCommitInfo {
  refs: string[];  // Branch/tag names pointing to this commit
}

export interface GitStash {
  index: number;
  message: string;
  branch: string;
  date: number;
}

export interface GitTag {
  name: string;
  sha: string;
  message?: string;
  tagger?: string;
  date?: number;
  isAnnotated: boolean;
}

export interface GitDiff {
  filePath: string;
  oldPath?: string;       // For renames
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: GitDiffHunk[];
}

export interface GitDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: GitDiffLine[];
}

export interface GitDiffLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// Conflict information for merge resolution
export interface GitConflict {
  path: string;
  ourContent: string;
  theirContent: string;
  baseContent?: string;
  ourBranch: string;
  theirBranch: string;
}

// Operation result types
export interface GitOperationResult {
  success: boolean;
  error?: string;
}

export interface GitStatusResult extends GitOperationResult {
  status?: GitStatus;
}

export interface GitBranchListResult extends GitOperationResult {
  branches?: GitBranch[];
  current?: string;
}

export interface GitLogResult extends GitOperationResult {
  commits?: GitLogEntry[];
}

export interface GitDiffResult extends GitOperationResult {
  diffs?: GitDiff[];
}

export interface GitStashListResult extends GitOperationResult {
  stashes?: GitStash[];
}

export interface GitTagListResult extends GitOperationResult {
  tags?: GitTag[];
}

export interface GitRemoteListResult extends GitOperationResult {
  remotes?: GitRemote[];
}

export interface GitCommitResult extends GitOperationResult {
  sha?: string;
}

export interface GitPushResult extends GitOperationResult {
  pushed?: boolean;
  upToDate?: boolean;
}

export interface GitPullResult extends GitOperationResult {
  updated?: boolean;
  upToDate?: boolean;
  conflicts?: string[];
}

export interface GitFetchResult extends GitOperationResult {
  fetched?: boolean;
}

export interface GitMergeResult extends GitOperationResult {
  merged?: boolean;
  conflicts?: string[];
}

export interface GitConflictResult extends GitOperationResult {
  conflicts?: GitConflict[];
}

// Request types for IPC
export interface GitStageRequest {
  repoPath: string;
  paths: string[];
}

export interface GitUnstageRequest {
  repoPath: string;
  paths: string[];
}

export interface GitCommitRequest {
  repoPath: string;
  message: string;
  amend?: boolean;
}

export interface GitPushRequest {
  repoPath: string;
  remote?: string;
  branch?: string;
  force?: boolean;
  setUpstream?: boolean;
}

export interface GitPullRequest {
  repoPath: string;
  remote?: string;
  branch?: string;
  rebase?: boolean;
}

export interface GitFetchRequest {
  repoPath: string;
  remote?: string;
  prune?: boolean;
}

export interface GitBranchCreateRequest {
  repoPath: string;
  name: string;
  startPoint?: string;
  checkout?: boolean;
}

export interface GitBranchDeleteRequest {
  repoPath: string;
  name: string;
  force?: boolean;
}

export interface GitCheckoutRequest {
  repoPath: string;
  target: string;  // Branch name or commit SHA
  createBranch?: boolean;
}

export interface GitMergeRequest {
  repoPath: string;
  branch: string;
  noFastForward?: boolean;
  squash?: boolean;
}

export interface GitRebaseRequest {
  repoPath: string;
  onto: string;
  abort?: boolean;
  continue?: boolean;
}

export interface GitStashRequest {
  repoPath: string;
  message?: string;
  includeUntracked?: boolean;
}

export interface GitStashApplyRequest {
  repoPath: string;
  index?: number;
  pop?: boolean;
}

export interface GitStashDropRequest {
  repoPath: string;
  index: number;
}

export interface GitLogRequest {
  repoPath: string;
  maxCount?: number;
  skip?: number;
  branch?: string;
  path?: string;
}

export interface GitDiffRequest {
  repoPath: string;
  cached?: boolean;      // Show staged changes
  path?: string;
  ref1?: string;
  ref2?: string;
}

export interface GitDiscardRequest {
  repoPath: string;
  paths: string[];
}

export interface GitResolveConflictRequest {
  repoPath: string;
  path: string;
  resolution: 'ours' | 'theirs' | 'custom';
  customContent?: string;
}

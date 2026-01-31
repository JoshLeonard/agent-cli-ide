export interface ProjectInfo {
  path: string;
  name: string;        // folder name for display
  isGitRepo: boolean;
  gitBranch?: string;
}

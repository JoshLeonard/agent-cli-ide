/**
 * Settings type definitions and defaults
 */

export interface QuickCommand {
  id: string;
  name: string;
  command: string;
  addNewline?: boolean;  // default: true (execute immediately)
  category?: string;     // for grouping in submenu
}

export interface Settings {
  version: 1;
  grid: {
    defaultRows: number;
    defaultCols: number;
  };
  restoreSessionsOnStartup: boolean;
  quickCommands: QuickCommand[];
  codeReview: {
    defaultAgentId: string | null;
  };
}

export const DEFAULT_QUICK_COMMANDS: QuickCommand[] = [
  // Git commands
  { id: 'git-status', name: 'git status', command: 'git status', category: 'Git' },
  { id: 'git-diff', name: 'git diff', command: 'git diff', category: 'Git' },
  { id: 'git-log', name: 'git log (10)', command: 'git log --oneline -10', category: 'Git' },
  { id: 'git-pull', name: 'git pull', command: 'git pull', category: 'Git' },
  // npm commands
  { id: 'npm-install', name: 'npm install', command: 'npm install', category: 'npm' },
  { id: 'npm-test', name: 'npm test', command: 'npm test', category: 'npm' },
  { id: 'npm-dev', name: 'npm run dev', command: 'npm run dev', category: 'npm' },
  { id: 'npm-build', name: 'npm run build', command: 'npm run build', category: 'npm' },
  // General commands
  { id: 'clear', name: 'clear', command: 'clear', category: 'General' },
  { id: 'pwd', name: 'pwd', command: 'pwd', category: 'General' },
  { id: 'ls-la', name: 'ls -la', command: 'ls -la', category: 'General' },
];

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  grid: {
    defaultRows: 2,
    defaultCols: 5,
  },
  restoreSessionsOnStartup: true,
  quickCommands: DEFAULT_QUICK_COMMANDS,
  codeReview: {
    defaultAgentId: null,
  },
};

export type PartialSettings = {
  grid?: Partial<Settings['grid']>;
  restoreSessionsOnStartup?: boolean;
  quickCommands?: QuickCommand[];
  codeReview?: Partial<Settings['codeReview']>;
};

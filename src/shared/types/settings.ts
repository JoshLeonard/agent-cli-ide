/**
 * Settings type definitions and defaults
 */

export interface Settings {
  version: 1;
  grid: {
    defaultRows: number;
    defaultCols: number;
  };
  restoreSessionsOnStartup: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  grid: {
    defaultRows: 2,
    defaultCols: 5,
  },
  restoreSessionsOnStartup: true,
};

export type PartialSettings = {
  grid?: Partial<Settings['grid']>;
  restoreSessionsOnStartup?: boolean;
};

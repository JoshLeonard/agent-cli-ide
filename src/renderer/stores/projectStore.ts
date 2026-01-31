import { create } from 'zustand';
import type { ProjectInfo } from '../../shared/types/project';

interface ProjectStore {
  currentProject: ProjectInfo | null;
  setProject: (project: ProjectInfo | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  setProject: (project) => set({ currentProject: project }),
}));

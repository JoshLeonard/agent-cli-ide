import { create } from 'zustand';
export const useProjectStore = create((set) => ({
    currentProject: null,
    setProject: (project) => set({ currentProject: project }),
}));
//# sourceMappingURL=projectStore.js.map
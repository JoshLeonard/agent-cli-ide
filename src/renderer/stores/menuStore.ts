import { create } from 'zustand';

interface MenuStore {
  openMenuId: string | null;
  openMenu: (menuId: string) => void;
  closeMenu: () => void;
  toggleMenu: (menuId: string) => void;
}

export const useMenuStore = create<MenuStore>((set, get) => ({
  openMenuId: null,

  openMenu: (menuId: string) => {
    set({ openMenuId: menuId });
  },

  closeMenu: () => {
    set({ openMenuId: null });
  },

  toggleMenu: (menuId: string) => {
    const state = get();
    if (state.openMenuId === menuId) {
      set({ openMenuId: null });
    } else {
      set({ openMenuId: menuId });
    }
  },
}));

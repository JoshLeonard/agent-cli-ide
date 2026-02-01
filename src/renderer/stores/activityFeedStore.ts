import { create } from 'zustand';
import type { ActivityEvent, ActivityType, ActivitySeverity, ActivityFilter } from '../../shared/types/activity';

interface ActivityFeedStore {
  events: ActivityEvent[];
  loading: boolean;
  error: string | null;

  // Filter state
  filterTypes: ActivityType[] | null;
  filterSeverities: ActivitySeverity[] | null;
  filterSessionIds: string[] | null;

  // Actions
  addEvent: (event: ActivityEvent) => void;
  setEvents: (events: ActivityEvent[]) => void;
  clearEvents: (sessionId?: string) => void;

  // Filter actions
  setFilterTypes: (types: ActivityType[] | null) => void;
  setFilterSeverities: (severities: ActivitySeverity[] | null) => void;
  setFilterSessionIds: (sessionIds: string[] | null) => void;
  clearFilters: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getFilteredEvents: () => ActivityEvent[];
}

// Maximum events to keep in memory
const MAX_EVENTS = 500;

export const useActivityFeedStore = create<ActivityFeedStore>((set, get) => ({
  events: [],
  loading: false,
  error: null,

  filterTypes: null,
  filterSeverities: null,
  filterSessionIds: null,

  addEvent: (event: ActivityEvent) => {
    set((state) => {
      const newEvents = [event, ...state.events].slice(0, MAX_EVENTS);
      return { events: newEvents };
    });
  },

  setEvents: (events: ActivityEvent[]) => {
    set({ events: events.slice(0, MAX_EVENTS) });
  },

  clearEvents: (sessionId?: string) => {
    if (sessionId) {
      set((state) => ({
        events: state.events.filter(e => e.sessionId !== sessionId),
      }));
    } else {
      set({ events: [] });
    }
  },

  setFilterTypes: (types: ActivityType[] | null) => {
    set({ filterTypes: types });
  },

  setFilterSeverities: (severities: ActivitySeverity[] | null) => {
    set({ filterSeverities: severities });
  },

  setFilterSessionIds: (sessionIds: string[] | null) => {
    set({ filterSessionIds: sessionIds });
  },

  clearFilters: () => {
    set({
      filterTypes: null,
      filterSeverities: null,
      filterSessionIds: null,
    });
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  getFilteredEvents: () => {
    const state = get();
    let filtered = state.events;

    if (state.filterTypes && state.filterTypes.length > 0) {
      filtered = filtered.filter(e => state.filterTypes!.includes(e.type));
    }

    if (state.filterSeverities && state.filterSeverities.length > 0) {
      filtered = filtered.filter(e => state.filterSeverities!.includes(e.severity));
    }

    if (state.filterSessionIds && state.filterSessionIds.length > 0) {
      filtered = filtered.filter(e => state.filterSessionIds!.includes(e.sessionId));
    }

    return filtered;
  },
}));

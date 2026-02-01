import { create } from 'zustand';
// Maximum events to keep in memory
const MAX_EVENTS = 500;
export const useActivityFeedStore = create((set, get) => ({
    events: [],
    loading: false,
    error: null,
    filterTypes: null,
    filterSeverities: null,
    filterSessionIds: null,
    addEvent: (event) => {
        set((state) => {
            const newEvents = [event, ...state.events].slice(0, MAX_EVENTS);
            return { events: newEvents };
        });
    },
    setEvents: (events) => {
        set({ events: events.slice(0, MAX_EVENTS) });
    },
    clearEvents: (sessionId) => {
        if (sessionId) {
            set((state) => ({
                events: state.events.filter(e => e.sessionId !== sessionId),
            }));
        }
        else {
            set({ events: [] });
        }
    },
    setFilterTypes: (types) => {
        set({ filterTypes: types });
    },
    setFilterSeverities: (severities) => {
        set({ filterSeverities: severities });
    },
    setFilterSessionIds: (sessionIds) => {
        set({ filterSessionIds: sessionIds });
    },
    clearFilters: () => {
        set({
            filterTypes: null,
            filterSeverities: null,
            filterSessionIds: null,
        });
    },
    setLoading: (loading) => {
        set({ loading });
    },
    setError: (error) => {
        set({ error });
    },
    getFilteredEvents: () => {
        const state = get();
        let filtered = state.events;
        if (state.filterTypes && state.filterTypes.length > 0) {
            filtered = filtered.filter(e => state.filterTypes.includes(e.type));
        }
        if (state.filterSeverities && state.filterSeverities.length > 0) {
            filtered = filtered.filter(e => state.filterSeverities.includes(e.severity));
        }
        if (state.filterSessionIds && state.filterSessionIds.length > 0) {
            filtered = filtered.filter(e => state.filterSessionIds.includes(e.sessionId));
        }
        return filtered;
    },
}));
//# sourceMappingURL=activityFeedStore.js.map
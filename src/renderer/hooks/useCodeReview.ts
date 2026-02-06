import { useEffect } from 'react';
import { initCodeReviewListeners } from '../stores/codeReviewStore';

/**
 * Hook to initialize code review IPC event listeners.
 * Should be called once in the root component.
 */
export function useCodeReview(): void {
  useEffect(() => {
    const cleanup = initCodeReviewListeners();
    return cleanup;
  }, []);
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Instantly resets window scroll position to the top upon route navigation.
 * Uses 'instant' behavior to avoid smooth-scroll panning lag during page transitions.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (_) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}

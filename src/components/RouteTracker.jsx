import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/tracking';

export default function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    // This will fire every time the location changes
    trackPageView(location.pathname + location.search);
  }, [location]);

  return null;
}

/**
 * Google Analytics 4 (GA4) Integration
 */

export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  if (!measurementId) {
    console.warn("GA4 Measurement ID is missing. Analytics will not be tracked.");
    return false;
  }

  // Prevent duplicate initialization
  if (window.dataLayer) return true;

  // Add the Google Analytics async script
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  document.head.appendChild(script);

  // Initialize the dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false // We will handle this manually in React
  });

  return true;
};

// --- GA4 Trackers ---

export const trackGAPageView = (path) => {
  if (typeof window === "undefined" || !window.gtag) return;
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) return;

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
    send_to: measurementId
  });
};

export const trackGAEvent = (eventName, params = {}) => {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
};

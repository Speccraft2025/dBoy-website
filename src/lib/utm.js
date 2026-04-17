/**
 * Extracts UTM parameters from URL and stores them in localStorage
 */

export const captureUTMParams = () => {
  if (typeof window === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);
  const utmParams = ['utm_source', 'utm_medium', 'utm_campaign'];
  
  let captured = false;
  
  utmParams.forEach(param => {
    const value = urlParams.get(param);
    if (value) {
      localStorage.setItem(`dboy_${param}`, value);
      captured = true;
    }
  });

  return captured;
};

export const getUTMParams = () => {
  if (typeof window === 'undefined') return {};
  
  return {
    source: localStorage.getItem('dboy_utm_source') || 'direct',
    medium: localStorage.getItem('dboy_utm_medium') || 'none',
    campaign: localStorage.getItem('dboy_utm_campaign') || 'none',
  };
};

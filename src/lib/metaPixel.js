/**
 * Meta (Facebook) Pixel Integration
 */

export const initMetaPixel = () => {
    const pixelId = import.meta.env.VITE_META_PIXEL_ID;
  
    if (!pixelId) {
      console.warn("Meta Pixel ID is missing. Meta Pixel will not be tracked.");
      return false;
    }
  
    if (window.fbq) return true; // Already initialized
  
    // Meta Pixel Base Code
    /* eslint-disable */
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
  
    window.fbq('init', pixelId);
    return true;
  };
  
// --- Meta Pixel Trackers ---
  
export const trackMetaPageView = () => {
    if (typeof window === "undefined" || !window.fbq) return;
    window.fbq('track', 'PageView');
};

export const trackMetaEvent = (eventName, params = {}) => {
    if (typeof window === "undefined" || !window.fbq) return;

    // Standard vs Custom event mapping
    const standardEvents = ['ViewContent', 'Search', 'AddToCart', 'AddToWishlist', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead', 'CompleteRegistration', 'Contact', 'CustomizeProduct', 'Donate', 'FindLocation', 'Schedule', 'StartTrial', 'SubmitApplication', 'Subscribe'];
    
    if (standardEvents.includes(eventName)) {
        window.fbq('track', eventName, params);
    } else {
        window.fbq('trackCustom', eventName, params);
    }
};

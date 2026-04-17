import { initGA, trackGAPageView, trackGAEvent } from './analytics';
import { initMetaPixel, trackMetaPageView, trackMetaEvent } from './metaPixel';

let initialized = false;

// Debouncing map
const recentEvents = new Map();

/**
 * Initialize all tracking systems
 */
export const initTracking = () => {
    if (initialized) return;
    initGA();
    initMetaPixel();
    initialized = true;
};

/**
 * Unified page view tracker
 */
export const trackPageView = (path) => {
    trackGAPageView(path);
    trackMetaPageView();
};

/**
 * Unified Event Tracker routing to both GA4 and Meta
 * 
 * Maps generic events to their respective platform standards.
 * 
 * Expected payload for specific events:
 * 
 * e-commerce (view_item, play_audio, add_to_cart, begin_checkout, purchase):
 * {
 *   item_id: string,
 *   item_name: string,
 *   value: number,
 *   currency: 'KES'
 * }
 */
export const trackEvent = (eventName, payload = {}) => {
    // Simple debounce to prevent double-firing in rapid succession (e.g. React StrictMode, double-clicks)
    const eventHash = `${eventName}-${JSON.stringify(payload)}`;
    const now = Date.now();
    if (recentEvents.has(eventHash) && now - recentEvents.get(eventHash) < 500) {
        return; // debounce for 500ms
    }
    recentEvents.set(eventHash, now);

    if (import.meta.env.DEV) {
        console.log(`[Tracking] ${eventName}`, payload);
    }

    // Default values
    const currency = payload.currency || 'KES';
    const value = typeof payload.value === 'number' ? payload.value : parseFloat(payload.value || 0);

    // Common e-commerce item format for GA4
    const gaItems = payload.item_id ? [{
        item_id: payload.item_id,
        item_name: payload.item_name,
        price: value,
        currency: currency
    }] : [];

    switch (eventName) {
        case 'view_item':
            // GA4
            trackGAEvent('view_item', {
                currency,
                value,
                items: gaItems
            });
            // Meta
            trackMetaEvent('ViewContent', {
                content_name: payload.item_name,
                content_ids: payload.item_id ? [payload.item_id] : [],
                content_type: 'product',
                value,
                currency
            });
            break;

        case 'play_audio':
            // GA4 (Custom / semi-standard event)
            trackGAEvent('play_audio', {
                item_id: payload.item_id,
                item_name: payload.item_name,
                value,
                currency
            });
            // Meta (No strict standard for this, use Custom event or ViewContent. Let's use custom.)
            trackMetaEvent('PlayAudio', {
                content_name: payload.item_name,
                content_ids: payload.item_id ? [payload.item_id] : [],
                value,
                currency
            });
            break;

        case 'add_to_cart':
            // GA4
            trackGAEvent('add_to_cart', {
                currency,
                value,
                items: gaItems
            });
            // Meta
            trackMetaEvent('AddToCart', {
                content_name: payload.item_name,
                content_ids: payload.item_id ? [payload.item_id] : [],
                content_type: 'product',
                value,
                currency
            });
            break;

        case 'begin_checkout':
            // GA4
            trackGAEvent('begin_checkout', {
                currency,
                value,
                items: gaItems
            });
            // Meta
            trackMetaEvent('InitiateCheckout', {
                content_name: payload.item_name,
                content_ids: payload.item_id ? [payload.item_id] : [],
                value,
                currency
            });
            break;

        case 'purchase':
            // GA4
            trackGAEvent('purchase', {
                transaction_id: payload.transaction_id || `TR_${Date.now()}`,
                value,
                currency,
                items: gaItems
            });
            // Meta
            trackMetaEvent('Purchase', {
                content_name: payload.item_name,
                content_ids: payload.item_id ? [payload.item_id] : [],
                content_type: 'product',
                value,
                currency
            });
            break;

        default:
            // Send generic custom events
            trackGAEvent(eventName, payload);
            trackMetaEvent(eventName, payload);
            break;
    }
};

const config = require('./config');

/**
 * Service module for Pesapal v3 API
 * Implements native fetch (Node 18+) to avoid 3rd party dependency issues.
 */

// Basic helper to execute fetch requests
async function pesapalRequest(endpoint, options = {}) {
  const url = `${config.pesapal.baseUrl}${endpoint}`;
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Pesapal API Error] ${url}`, response.status, errorBody);
    throw new Error(`Pesapal Error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

/**
 * Request an authentication token
 */
async function getAuthToken() {
  const payload = {
    consumer_key: config.pesapal.consumerKey,
    consumer_secret: config.pesapal.consumerSecret
  };

  const data = await pesapalRequest('/api/Auth/RequestToken', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!data?.token) {
    console.error('[Pesapal Auth Failure Data]', JSON.stringify(data));
    const errMsg = data?.error?.message || data?.message || 'Failed to retrieve Pesapal Auth Token - Check consumer keys';
    throw new Error(errMsg);
  }

  return data.token;
}

/**
 * Register a webhook IPN
 */
async function registerIPN(token, ipnUrl) {
  const payload = {
    url: ipnUrl,
    ipn_notification_type: 'POST'
  };

  const data = await pesapalRequest('/api/URLSetup/RegisterIPN', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });

  if (!data?.ipn_id) {
    throw new Error('Failed to register IPN with Pesapal');
  }

  return data.ipn_id;
}

/**
 * Submit an order request to generate payment link
 */
async function submitOrderRequest(token, orderPayload) {
  const data = await pesapalRequest('/api/Transactions/SubmitOrderRequest', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(orderPayload)
  });

  return data; // Returns { redirect_url, order_tracking_id, ... }
}

/**
 * Retrieve the status of a specific transaction
 */
async function getTransactionStatus(token, orderTrackingId) {
  const endpoint = `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`;
  
  const data = await pesapalRequest(endpoint, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  return data; // Returns { payment_status_description, amount, currency, ... }
}

module.exports = {
  getAuthToken,
  registerIPN,
  submitOrderRequest,
  getTransactionStatus
};

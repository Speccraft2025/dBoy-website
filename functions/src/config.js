// Configuration loader for Firebase Functions
const { defineString } = require('firebase-functions/params');

// Pesapal credentials defined via Firebase environment parameters
// To set these in production: 
// firebase functions:secrets:set PESAPAL_CONSUMER_KEY
// firebase functions:secrets:set PESAPAL_CONSUMER_SECRET

const consumerKey = defineString('PESAPAL_CONSUMER_KEY', { default: 'YOUR_TEST_KEY' });
const consumerSecret = defineString('PESAPAL_CONSUMER_SECRET', { default: 'YOUR_TEST_SECRET' });
const pesapalEnv = defineString('PESAPAL_ENV', { default: 'sandbox' }); // 'sandbox' or 'production'

module.exports = {
  pesapal: {
    get consumerKey() { return consumerKey.value(); },
    get consumerSecret() { return consumerSecret.value(); },
    get isLive() { return pesapalEnv.value() === 'production'; },
    get baseUrl() { 
      return this.isLive 
        ? 'https://pay.pesapal.com/v3'
        : 'https://cybqa.pesapal.com/pesapalv3'; // Pesapal sandbox environment
    }
  }
};

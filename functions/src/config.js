// Configuration loader for Firebase Functions
const { defineSecret, defineString } = require('firebase-functions/params');

// Pesapal credentials defined via Firebase Secret Manager
// These match the secrets set via 'firebase functions:secrets:set ...'
const consumerKey = defineSecret('PESAPAL_CONSUMER_KEY');
const consumerSecret = defineSecret('PESAPAL_CONSUMER_SECRET');
const pesapalEnv = defineSecret('PESAPAL_ENV'); 

module.exports = {
  pesapal: {
    get consumerKey() { return consumerKey.value(); },
    get consumerSecret() { return consumerSecret.value(); },
    get isLive() { return pesapalEnv.value() === 'production'; },
    get baseUrl() { 
      return this.isLive 
        ? 'https://pay.pesapal.com/v3'
        : 'https://cybqa.pesapal.com/pesapalv3'; 
    }
  }
};

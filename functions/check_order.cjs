const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'dboywebsite'
});
const db = admin.firestore();

async function checkOrder() {
  const orderId = 'Wd3fCrjqvYH2DAANMXtu';
  const doc = await db.collection('orders').doc(orderId).get();
  if (doc.exists) {
    console.log(JSON.stringify(doc.data(), null, 2));
  } else {
    console.log('Order not found');
  }
}

checkOrder().catch(console.error);

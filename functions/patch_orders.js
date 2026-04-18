const admin = require('firebase-admin');

// Initialize with application default or Service Account
admin.initializeApp({
  projectId: 'dboywebsite'
});

const db = admin.firestore();

const orderRefs = [
  'ZZUBvWM49Ujfz1tsHu5H',
  '7ebnMNcgopPUDdM2F75K',
  'Pt90X7tm06NsQjGPMN2n',
  '3XY0xa3FDodHVnQt8AO5'
];

async function patchOrders() {
  console.log('--- Starting Manual Order Patch ---');
  for (const ref of orderRefs) {
    try {
      const docRef = db.collection('orders').doc(ref);
      const snap = await docRef.get();
      
      if (!snap.exists) {
        console.log(`[SKIPPED] Order ${ref} does not exist in Firestore.`);
        continue;
      }

      await docRef.update({
        status: 'paid',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        manualActivation: true
      });
      console.log(`[SUCCESS] Order ${ref} set to PAID.`);
    } catch (err) {
      console.error(`[ERROR] Failed to update ${ref}:`, err.message);
    }
  }
  console.log('--- Patch Complete ---');
}

patchOrders().then(() => process.exit(0));

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fullPath = path.resolve(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  }
  return null;
}

const sa = parseServiceAccount();
if (!sa) {
  console.error("No Firebase service account found. Please check your .env file.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(sa) });
const firestore = admin.firestore();

async function clearReports() {
  const reportsRef = firestore.collection('reports');
  const snapshot = await reportsRef.get();
  
  if (snapshot.empty) {
    console.log('No reports found to delete.');
    process.exit(0);
  }

  console.log(`Found ${snapshot.size} reports to delete...`);
  
  // Firestore batch limit is 500, but we likely have way less
  const batch = firestore.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log('✅ All reports cleared successfully.');
  process.exit(0);
}

clearReports().catch(e => {
  console.error('Error clearing reports:', e);
  process.exit(1);
});

const admin = require('firebase-admin');

// Replace with your Firebase project's service account key
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;

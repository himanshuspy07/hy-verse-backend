const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

module.exports = async (req, res) => {
  // 1. SET CORS HEADERS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allows your web app to connect
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. HANDLE PREFLIGHT REQUEST
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { recipientId, title, body, url, icon } = req.body;
  if (!recipientId) return res.status(400).json({ error: "Missing recipientId" });

  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(recipientId).get();

    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const fcmTokens = userDoc.data().fcmTokens || [];
    if (fcmTokens.length === 0) return res.status(200).json({ message: "No devices" });

    const message = {
      tokens: fcmTokens,
      notification: { title, body },
      data: { url: url || "/" },
      webpush: {
        notification: {
          icon: icon || "/icon-192.png",
          badge: "/icon-192.png",
          click_action: url || "/"
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    return res.status(200).json({ success: true, sent: response.successCount });

  } catch (error) {
    console.error("Backend error:", error);
    return res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

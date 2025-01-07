const admin = require("firebase-admin");

// Firebase Admin SDK Initialization
const serviceAccount = require("../services/kikati-cf755-firebase-adminsdk-zg1xn-0c8bc19806.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Function to Send Notifications
const sendNotification = async (token, title, body, data = {}) => {
  const payloadSend = {
    token: token,
    notification: {
      title: String(title), // Ensure title is a string
      body: String(body),   // Ensure body is a string
    },
    data: data, // Optional custom data
    android: {
      priority: "high",
    },
    apns: {
      payload: {
        aps: {
          badge: 1, // Optional badge count
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(payloadSend);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.error("Error sending message:", error);
  }
};


module.exports = sendNotification;
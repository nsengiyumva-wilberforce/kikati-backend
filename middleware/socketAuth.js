// middleware/socketAuth.js
const jwt = require("jsonwebtoken");

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token; // Expect the token to be sent in the handshake

  if (!token) {
    return next(new Error("Authentication error"));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error("Authentication error"));
    }
    socket.userId = decoded.id; // Store user ID in socket for later use
    socket.username = decoded.username;
    next();
  });
};

module.exports = authenticateSocket;

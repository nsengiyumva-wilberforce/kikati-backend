const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const socketIo = require("socket.io");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const groupRoutes = require("./routes/groups");
const path = require("path");
const socketAuth = require("./middleware/socketAuth");

// Create an express app
const app = express();
// Create the server
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Update to your frontend URL in production
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
io.use(socketAuth);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Store active users and their last active time
const activeUsers = new Map(); // Map to store username and socket ID

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes(io, activeUsers)); // Pass activeUsers map
app.use("/api/groups", groupRoutes(io));
app.use("/uploads", express.static("uploads"));

// Serve index.html on root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html")); // Adjust the path as needed
});

// Socket.IO Events
io.on("connection", (socket) => {
  console.log("Client connected");

  // When a user connects, register them as online
  socket.on("registerUser", (username) => {
    activeUsers.set(username, socket.id); // Store the username and socket ID
    io.emit(
      "activeUsers",
      Array.from(activeUsers.keys()).map((user) => ({
        username: user,
        lastActive: null, // You can customize this as needed
      }))
    );

    console.log(activeUsers);
  });

  // When a user disconnects, remove them from active users
  socket.on("disconnect", () => {
    const username = [...activeUsers.keys()].find(
      (user) => activeUsers.get(user) === socket.id
    );
    if (username) {
      activeUsers.delete(username);
      io.emit(
        "activeUsers",
        Array.from(activeUsers.keys()).map((user) => ({
          username: user,
          lastActive: null, // Update as necessary
        }))
      );
    }
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

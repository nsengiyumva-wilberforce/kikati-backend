const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const socketIo = require("socket.io");
const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const groupRoutes = require("./routes/groups");
const userRoutes = require("./routes/user");
const path = require("path");
const socketAuth = require("./middleware/socketAuth");
const User = require("./models/User");
const socketEvents = require("./events/socketEvents"); // Import socket events
const postRoutes = require("./routes/posts");
const marketRoutes = require("./routes/market");

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
io.use(socketAuth); // Using the socketAuth middleware to validate the user for each socket connection

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Store active users and their last active time
const activeUsers = new Map(); // Map to store user _id and socket ID

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes(io, activeUsers)); // Pass activeUsers map
app.use("/api/groups", groupRoutes(io));
app.use("/api/users", userRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/posts", postRoutes(io, activeUsers));
app.use("/api/market", marketRoutes(io, activeUsers));

// Serve index.html on root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html")); // Adjust the path as needed
});

// Socket.IO Events
socketEvents(io, activeUsers); // Pass io and activeUsers map to socketEvents

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

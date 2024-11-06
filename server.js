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
const User = require("./models/User"); // Assuming you have a User model
const Message = require("./models/Message");

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
app.use("/uploads", express.static("uploads"));

// Serve index.html on root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html")); // Adjust the path as needed
});

// Socket.IO Events
io.on("connection", (socket) => {
  console.log("Client connected");

  // When a user connects, register them as online
  socket.on("registerUser", async (username) => {
    try {
      // Find user by username in the database to get their MongoDB _id
      const user = await User.findOne({ username });

      if (user) {
        // Update the user isActive to true when they connect
        await User.updateOne(
          { username: user.username }, // Assuming `socket.userId` is set by socketAuth middleware
          { $set: { isActive: true, lastActive: new Date() } }
        );

        // Add to active users with userId, username, and socketId
        activeUsers.set(user._id.toString(), {
          username,
          connection_details: socket.id,
        });

        // Emit the active users list to all connected clients
        io.emit("activeUsers", Array.from(activeUsers.values()));

        console.log(
          `User ${user.username} registered with socketId: ${socket.id}`
        );
      }
    } catch (err) {
      console.log("Error registering user:", err);
    }
  });

  // Handle incoming direct messages
  socket.on("sendMessage", async ({ recipientId, content, from }) => {
    // save the message in the database

    const recipient = activeUsers.get(recipientId);
    if (recipient) {
      console.log("Recipient found:", recipient);
      //get logged in user id
      const user = await User.findOne({ username: from });
      const message = new Message({
        sender: user._id.toString(),
        recipient: recipientId,
        content: content,
      });

      console.log("Message:", message);

      await message.save();
      // Send message to the recipient using their socketId
      io.to(recipient.connection_details).emit("directMessage", {
        sender: recipient.username,
        content,
        from,
      });
      console.log(`Message from ${socket.id} to ${recipientId}: ${content}`);
    } else {
      console.log(`User ${recipientId} not found`);
    }
  });

  // When a user disconnects, remove them from active users and update the database
  socket.on("disconnect", async () => {
    // Find the user associated with the socket
    const userId = [...activeUsers.entries()].find(
      ([, value]) => value.socketId === socket.id
    )?.[0];

    if (userId) {
      activeUsers.delete(userId);

      // Update the user status to inactive in the database when they disconnect
      await User.updateOne(
        { _id: userId },
        { $set: { isActive: false, lastActive: new Date() } }
      );

      // Emit the updated active users list to all connected clients
      io.emit("activeUsers", Array.from(activeUsers.values()));

      console.log(`User with socketId ${socket.id} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

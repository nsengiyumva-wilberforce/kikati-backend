const express = require("express");
const auth = require("../middleware/auth"); // Your auth middleware
const emailVerified = require("../middleware/email-verified"); // Your email verification middleware
const Message = require("../models/Message");

const router = express.Router();

module.exports = (io) => {
  // Send a message
  router.post("/send", auth, emailVerified, async (req, res) => {
    const { recipient, content } = req.body;

    try {
      const message = new Message({
        sender: req.user.id,
        recipient,
        content,
      });

      await message.save();

      // Emit the message to all connected clients
      io.emit("messageReceived", {
        sender: req.user.id,
        recipient,
        content,
      });

      res.status(201).json({ message: "Message sent successfully", message });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get messages between users
  router.get("/conversation/:recipientId", auth, emailVerified, async (req, res) => {
    const { recipientId } = req.params;

    try {
      const messages = await Message.find({
        $or: [
          { sender: req.user.id, recipient: recipientId },
          { sender: recipientId, recipient: req.user.id },
        ],
      }).sort({ createdAt: 1 }); // Sort by creation date

      res.status(200).json(messages);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get all messages for the logged-in user
  router.get("/", auth, emailVerified, async (req, res) => {
    try {
      const messages = await Message.find({ recipient: req.user.id })
        .populate("sender", "username") // Assuming sender has a 'username' field
        .sort({ createdAt: -1 }); // Sort messages by creation date

      res.status(200).json(messages);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Delete a message
  router.delete("/:messageId", auth, emailVerified, async (req, res) => {
    try {
      const message = await Message.findById(req.params.messageId);
  
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
  
      // Optionally, check if the user is the sender or the recipient of the message
      if (
        message.sender.toString() !== req.user.id &&
        message.recipient.toString() !== req.user.id
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this message" });
      }
  
      await Message.findByIdAndDelete(req.params.messageId); // Use this instead
      res.status(200).json({ message: "Message deleted successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });
  

  return router; // Return the router
};

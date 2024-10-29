const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth"); // Your auth middleware
const emailVerified = require("../middleware/email-verified"); // Your email verification middleware
const Message = require("../models/Message");

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // Specify the upload directory

module.exports = (io, activeUsers) => {
  // Send a message
  router.post(
    "/send",
    auth,
    emailVerified,
    upload.array("media"),
    async (req, res) => {
      const { recipient, content } = req.body;

      try {
        const mediaFiles = req.files
          ? req.files.map((file) => ({
              url: `/uploads/${file.filename}`, // Assuming you're serving files from the 'uploads' directory
              type: file.mimetype.startsWith("image/")
                ? "image"
                : file.mimetype.startsWith("video/")
                ? "video"
                : "file",
              filename: file.originalname,
            }))
          : [];

        const message = new Message({
          sender: req.user.id,
          recipient,
          content,
          media: mediaFiles, // Include media files
        });

        await message.save();

        // Check if the recipient is online and emit the message directly to them
        if (activeUsers.has(recipient)) {
          const recipientSocketId = activeUsers.get(recipient);
          io.to(recipientSocketId).emit("directMessage", {
            sender: req.user.id,
            content,
            media: mediaFiles, // Include media in the emitted message
          });
        } else {
          console.log("user not found.....");
        }

        res.status(201).json({ message: "Message sent successfully", message });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
      }
    }
  );
  // Get messages between users
  router.get(
    "/conversation/:recipientId",
    auth,
    emailVerified,
    async (req, res) => {
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
    }
  );

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

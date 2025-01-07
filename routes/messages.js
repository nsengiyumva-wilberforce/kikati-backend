const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth"); // Your auth middleware
const emailVerified = require("../middleware/email-verified"); // Your email verification middleware
const Message = require("../models/Message");
const Token = require("../models/Token"); // Import your Token model
const User = require("../models/User");
const sendNotification = require("../services/firebase"); // Import the sendNotification function

const router = express.Router();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads"); // The folder to save the file
  },
  filename: function (req, file, cb) {
    // Extract file extension from mimetype
    const ext = file.mimetype.split("/")[1]; // Extract the file extension (e.g., 'png', 'jpeg')

    // Create a unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    // Save the file with its proper extension
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  },
});

const upload = multer({ storage }); // Specify the upload directory

module.exports = (io, activeUsers) => {
  // Send a message
  // router.post(
  //   "/send",
  //   auth,
  //   emailVerified,
  //   upload.array("media"),
  //   async (req, res) => {
  //     const { recipient, content } = req.body;

  //     try {
  //       const mediaFiles = req.files
  //         ? req.files.map((file) => ({
  //             url: `/uploads/${file.filename}`, // Assuming you're serving files from the 'uploads' directory
  //             type: file.mimetype.startsWith("image/")
  //               ? "image"
  //               : file.mimetype.startsWith("video/")
  //               ? "video"
  //               : "file",
  //             filename: file.originalname,
  //           }))
  //         : [];

  //       const message = new Message({
  //         sender: req.user.id,
  //         recipient,
  //         content,
  //         media: mediaFiles, // Include media files
  //       });

  //       await message.save();

  //       // Check if the recipient is online and emit the message directly to them
  //       if (activeUsers.has(recipient)) {
  //         const recipientSocketId = activeUsers.get(recipient);
  //         io.to(recipientSocketId).emit("directMessage", {
  //           sender: req.user.id,
  //           content,
  //           media: mediaFiles, // Include media in the emitted message
  //         });
  //       } else {
  //         console.log("User not found...");
  //       }

  //       res.status(201).json({ message: "Message sent successfully", message });
  //     } catch (error) {
  //       console.log(error);
  //       res.status(500).json({ message: "Server error" });
  //     }
  //   }
  // );

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
          console.log("User not found...");
        }

        // Fetch recipient's token from database (assuming you have it stored)
        const recipientUser = await User.findById(recipient);

        const recipientToken = await Token.findOne({
          userId: recipient,
        });
        if (recipientUser && recipientToken.deviceToken) {
          const payload = {
            title: "New Message Received",
            body: content || "You have a new message",
          };

          await sendNotification(
            recipientToken.deviceToken,
            JSON.stringify(payload.title),
            JSON.stringify(payload.body)
          );
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
      console.log("Recipient ID:", recipientId);
      console.log("User ID:", req.user.id);
      try {
        const messages = await Message.find({
          $or: [
            { sender: req.user.id, recipient: recipientId },
            { sender: recipientId, recipient: req.user.id },
          ],
        })
          .sort({ createdAt: 1 }) // Sort by creation date
          .populate("sender", "username") // Populate sender with username
          .populate("recipient", "username"); // Populate recipient with username

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

  // GET route to fetch active users
  router.get("/active-users", auth, emailVerified, (req, res) => {
    try {
      // Prepare the active users data from the activeUsers Map
      const activeUserList = Array.from(activeUsers.entries()).map(
        ([userId, socketId]) => ({
          userId,
          socketId,
        })
      );

      // Send the list of active users back in the response
      res.status(200).json(activeUserList);
    } catch (error) {
      console.log("Error fetching active users:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router; // Return the router
};

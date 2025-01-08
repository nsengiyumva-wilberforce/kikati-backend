const express = require("express");
const auth = require("../middleware/auth"); // Your auth middleware
const emailVerified = require("../middleware/email-verified"); // Your email verification middleware
const Group = require("../models/Group");
const User = require("../models/User");
const Message = require("../models/Message");

const router = express.Router();

module.exports = (io, activeUsers) => {
  // Create a group
  router.post("/create", auth, emailVerified, async (req, res) => {
    const { name, members } = req.body; // members is an array of user IDs

    try {
      const group = new Group({
        name,
        members: [...members, req.user.id], // Add the creator to the group
      });

      await group.save();

      // Add the group to the creator's user record
      await User.findByIdAndUpdate(req.user.id, {
        $push: { groups: group._id },
      });

      res.status(201).json({ message: "Group created successfully", group });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Join a group
  router.post("/join", auth, emailVerified, async (req, res) => {
    const { groupId } = req.body;

    try {
      const group = await Group.findById(groupId);

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Add the user to the group's members
      group.members.push(req.user.id);
      await group.save();

      // Add the group to the user's groups
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { groups: groupId },
      });

      // Notify all group members that a new user has joined
      io.to(groupId).emit("userJoined", {
        message: `${req.user.username} has joined the group.`,
        groupId,
      });

      res.status(200).json({ message: "Successfully joined the group", group });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Leave a group
  router.post("/leave", auth, emailVerified, async (req, res) => {
    const { groupId } = req.body;

    try {
      const group = await Group.findById(groupId);

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Remove the user from the group's members
      group.members.pull(req.user.id);
      await group.save();

      // Remove the group from the user's groups
      await User.findByIdAndUpdate(req.user.id, { $pull: { groups: groupId } });

      // Notify the group members that the user has left
      io.to(groupId).emit("userLeft", {
        message: `${req.user.username} has left the group.`,
        groupId,
      });

      res.status(200).json({ message: "Successfully left the group" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Send a message to a group
  router.post("/sendMessage", auth, emailVerified, async (req, res) => {
    const { groupId, content } = req.body;

    try {
      const group = await Group.findById(groupId);

      if (!group || !group.members.includes(req.user.id)) {
        return res
          .status(403)
          .json({ message: "User not a member of the group" });
      }

      const message = new Message({
        sender: req.user.id,
        groupId,
        content,
      });

      await message.save();

      // Emit the message to all members of the group (broadcasting to all members)
      io.to(groupId).emit("messageReceived", {
        sender: req.user.id,
        groupId,
        content,
      });

      res.status(201).json({ message: "Message sent successfully" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get all groups in the system
  router.get("/all-groups", auth, emailVerified, async (req, res) => {
    try {
      // Fetch all groups
      const groups = await Group.find().populate("members", "-password");

      res.status(200).json({ groups });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get groups that the logged-in user belongs to
  router.get("/my-groups", auth, emailVerified, async (req, res) => {
    try {
      // Fetch the user with their groups populated
      const user = await User.findById(req.user.id).populate({
        path: "groups",
        populate: {
          path: "members",
          select: "-password", // Exclude the password field
        },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Send the populated groups back to the user
      res.status(200).json({ groups: user.groups });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Optional: Get group details
  router.get("/:id", auth, emailVerified, async (req, res) => {
    try {
      const group = await Group.findById(req.params.id).populate(
        "members",
        "username"
      ); // Populate with member usernames

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.status(200).json(group);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get all messages in a group
  router.get("/messages/:groupId", auth, emailVerified, async (req, res) => {
    try {
      const group = await Group.findById(req.params.groupId);

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Check if the user is a member of the group
      if (!group.members.includes(req.user.id)) {
        return res
          .status(403)
          .json({ message: "User not a member of the group" });
      }

      // Fetch all messages in the group and populate the related details
      const messages = await Message.find({ groupId: req.params.groupId })
        .populate("sender", "-password") // Populate sender details, excluding the password
        .populate("recipient", "name email") // Populate recipient details (optional)
        .populate("groupId"); // Populate group details, including everything

      res.status(200).json({ messages });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // When a user connects to the group, we register them as online
  io.on("connection", (socket) => {
    console.log("Client connected to socket");

    // Register a user for a specific group
    socket.on("joinGroup", (groupId) => {
      console.log(`User with socketId ${socket.id} joined group ${groupId}`);
      socket.join(groupId); // Join the group room
    });

    // When a user disconnects, we remove them from all groups
    socket.on("disconnect", () => {
      console.log(`User with socketId ${socket.id} disconnected`);
      // You can clean up any other resources or user-specific info here
    });
  });

  return router;
};

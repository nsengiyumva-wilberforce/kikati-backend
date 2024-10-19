const express = require("express");
const auth = require("../middleware/auth"); // Your auth middleware
const emailVerified = require("../middleware/email-verified"); // Your email verification middleware
const Group = require("../models/Group");
const User = require("../models/User");
const Message = require("../models/Message");

const router = express.Router();

module.exports = (io) => {
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
        return res.status(403).json({ message: "User not a member of the group" });
      }

      const message = new Message({
        sender: req.user.id,
        groupId,
        content,
      });

      await message.save();

      // Emit to all members of the group
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

  // Optional: Get group details
  router.get("/:id", auth, emailVerified, async (req, res) => {
    try {
      const group = await Group.findById(req.params.id).populate("members", "username"); // Populate with member usernames

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.status(200).json(group);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};


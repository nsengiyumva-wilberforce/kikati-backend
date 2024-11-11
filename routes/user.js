const express = require("express");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

const router = express.Router();

// Search for users by username, email, first name, or last name
router.get("/search", async (req, res) => {
  const { query } = req.query; // Search query (can be username, email, first name, or last name)

  if (!query) {
    return res.status(400).json({ message: "Search query is required" });
  }

  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } }, // Case-insensitive search on username
        { email: { $regex: query, $options: "i" } }, // Case-insensitive search on email
        { firstName: { $regex: query, $options: "i" } }, // Case-insensitive search on first name
        { lastName: { $regex: query, $options: "i" } }, // Case-insensitive search on last name
      ],
    }).select("-password"); // Exclude password from results

    res.json(users); // Return the list of users found
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/send-friend-request", auth, async (req, res) => {
  const { targetUsername } = req.body; // The username of the user the request is being sent to

  try {
    const sender = req.user; // The current logged-in user
    const target = await User.findOne({ username: targetUsername });

    if (!target) {
      return res.status(404).json({ message: "Target user not found" });
    }

    // check if there is a pending friend request from the sender
    const friendRequest = await User.findOne({
      _id: sender.id,
      friendRequests: target._id,
    });

    if (friendRequest) {
      return res.status(400).json({ message: "Friend request already sent" });
    }

    // check if the target sent a friend request to the sender
    const friendRequest2 = await User.findOne({
      _id: target._id,
      friendRequests: sender.id,
    });

    if (friendRequest2) {
      return res
        .status(400)
        .json({ message: "You have a pending friend request from this user" });
    }

    // check if they are already friends
    const isFriend = await User.findOne({
      _id: sender.id,
      friends: target._id,
    });

    if (isFriend) {
      return res
        .status(400)
        .json({ message: "You are already friends with this user" });
    }

    // Send the friend request by updating the target's friendRequests array
    const sendRequestResult = await User.updateOne(
      { _id: target._id },
      { $push: { friendRequests: sender.id } }
    );

    // Check if the update was successful
    if (sendRequestResult.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to send friend request" });
    }

    console.log("Friend request sent successfully");

    res.json({ message: "Friend request sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/accept-friend-request", auth, async (req, res) => {
  const { senderUsername } = req.body; // Username of the sender of the friend request
  console.log(senderUsername);

  try {
    const receiver = req.user; // The current logged-in user (receiver)
    const sender = await User.findOne({ username: senderUsername });

    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    // Check if there is a pending friend request from the sender
    const friendRequest = await User.findOne({
      _id: receiver.id,
      friendRequests: sender._id,
    });

    if (!friendRequest) {
      return res
        .status(400)
        .json({ message: "No friend request from this user" });
    }

    // Add sender._id to receiver's friends list and receiver.id to sender's friends list
    // Use await to ensure these operations happen in sequence
    const addSenderToReceiverFriends = User.updateOne(
      { _id: sender._id },
      { $push: { friends: receiver.id } }
    );

    const addReceiverToSenderFriends = User.updateOne(
      { _id: receiver.id },
      { $push: { friends: sender._id } }
    );

    // Wait for both friend list updates to complete
    await Promise.all([addSenderToReceiverFriends, addReceiverToSenderFriends]);

    // Remove the friend request from the receiver's list
    const removeFriendRequest = User.updateOne(
      { _id: receiver.id },
      { $pull: { friendRequests: sender._id } }
    );

    // Wait for the removal of the friend request
    await removeFriendRequest;

    // If all operations were successful, respond with success
    res.json({ message: "Friend request accepted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// Reject friend request
router.post("/reject-friend-request", auth, async (req, res) => {
  const { senderUsername } = req.body; // Username of the sender of the friend request

  try {
    const receiver = req.user; // The current logged-in user (receiver)
    const sender = await User.findOne({ username: senderUsername });

    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }

    // Check if there is a pending friend request from the sender
    const friendRequest = await User.findOne({
      _id: receiver.id,
      friendRequests: sender._id,
    });

    if (!friendRequest) {
      return res
        .status(400)
        .json({ message: "No friend request from this user" });
    }

    // Remove the friend request from the receiver's list (using $pull to update the database directly)
    await User.updateOne(
      { _id: receiver.id },
      { $pull: { friendRequests: sender._id } }
    );

    res.json({ message: "Friend request rejected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// List friends
router.get("/friends", auth, async (req, res) => {
  try {
    const user = req.user; // The current logged-in user
    const UserDetails = await User.findById(user.id).select("-password");
    const friends = await User.find({
      _id: { $in: UserDetails.friends },
    }).select("-password");

    res.json(friends);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;

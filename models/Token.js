const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to the User model
    required: true,
  },
  deviceToken: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    enum: ["android", "ios", "web"],
    required: true, // Specify which platform the token belongs to
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Token", tokenSchema);

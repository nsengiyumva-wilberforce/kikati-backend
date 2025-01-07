const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Make recipient optional for group messages
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" }, // Optional for group messages
  content: { type: String, required: true },
  media: {
    type: [
      {
        url: { type: String, required: true }, // URL of the media file
        type: {
          type: String,
          enum: ["image", "video", "file"],
          required: true,
        }, // Type of media
        filename: { type: String }, // Original filename (optional)
      },
    ],
    default: [], // Default to an empty array if no media is sent
  },
  timestamp: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  lastActive: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", MessageSchema);

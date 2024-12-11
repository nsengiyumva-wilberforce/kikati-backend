const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String,unique: true },
  password: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); // Simple email regex
      },
      message: (props) => `${props.value} is not a valid email!`,
    },
  },
  firstName: { type: String },
  lastName: { type: String },
  gender: {
    type: String,
    enum: ["male", "female", "other", "Female", "Male", "Other"]
  },
  dateOfBirth: { type: Date },
  phoneNumber: {
    type: String,
    unique: true,
  },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }], // Array of Group references
  isEmailConfirmed: { type: Boolean, default: false }, // Email confirmation status
  confirmationCode: { type: String }, // Confirmation code
  confirmationCodeExpires: { type: Date }, // Code expiration time
  resetCode: { type: String },
  resetCodeExpires: { type: Date },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // List of friends (references to other users)
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // List of users who have sent requests
  isActive: { type: Boolean, default: false }, // Set to false by default
  lastActive: { type: Date }, // Updated when the user logs out
});

module.exports = mongoose.model("User", UserSchema);

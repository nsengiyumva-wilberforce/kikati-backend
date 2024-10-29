const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
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
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  gender: {
    type: String,
    enum: ["male", "female", "other", "Female", "Male", "Other"],
    required: true,
  },
  dateOfBirth: { type: Date, required: true },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }], // Array of Group references
  isEmailConfirmed: { type: Boolean, default: false }, // Email confirmation status
  confirmationCode: { type: String }, // Confirmation code
  confirmationCodeExpires: { type: Date }, // Code expiration time
  resetCode: { type: String },
  resetCodeExpires: { type: Date },
});

module.exports = mongoose.model("User", UserSchema);

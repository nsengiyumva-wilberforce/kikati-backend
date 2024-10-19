const express = require("express");
const User = require("../models/User");
const Message = require("../models/Message");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const { sendConfirmationEmail } = require("../services/emailService"); // Adjust the path as needed

const router = express.Router();

// Registration route
router.post("/register", async (req, res) => {
  const {
    username,
    password,
    email,
    firstName,
    lastName,
    gender,
    dateOfBirth,
  } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const confirmationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const confirmationCodeExpires = Date.now() + 15 * 60 * 1000; // Code expires in 15 minutes

    const newUser = new User({
      username,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      isEmailConfirmed: false,
      confirmationCode,
      confirmationCodeExpires,
    });
    await newUser.save();

    await sendConfirmationEmail(email, username, confirmationCode);

    res.status(201).json({
      message:
        "User created successfully, a 6-digit code has been sent to your email for confirmation, and it will expire in 15 minutes.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify confirmation code
router.post("/verify-code", async (req, res) => {
  const { username, code } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the code is correct and not expired
    if (
      user.confirmationCode !== code ||
      Date.now() > user.confirmationCodeExpires
    ) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Mark email as confirmed
    user.isEmailConfirmed = true;
    user.confirmationCode = undefined; // Clear the code
    user.confirmationCodeExpires = undefined; // Clear expiration
    await user.save();

    res.json({ message: "Email confirmed successfully!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Resend confirmation code
router.post("/resend-code", async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isEmailConfirmed) {
      return res.status(400).json({ message: "Email is already confirmed." });
    }

    // Generate a new confirmation code
    const confirmationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const confirmationCodeExpires = Date.now() + 15 * 60 * 1000; // Code expires in 15 minutes

    // Update user with the new code and expiration
    user.confirmationCode = confirmationCode;
    user.confirmationCodeExpires = confirmationCodeExpires;
    await user.save();

    // Send the new confirmation email
    await sendConfirmationEmail(user.email, user.username, confirmationCode);

    res.json({ message: "New confirmation code sent to your email." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login a user
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (error) {
    console.error(error); // Log the error
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Request password reset
router.post("/request-password-reset", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const resetLink = `http://your-app-url/reset-password/${resetToken}`; // Update with your app URL

    // Send reset email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      text: `To reset your password, click the link: ${resetLink}`,
    });

    res.json({ message: "Password reset link sent to your email." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset password
router.post("/reset-password/:token", async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ message: "Invalid token" });
    }

    // Hash the new password
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.json({ message: "Password reset successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Logout route
router.post("/logout", auth, (req, res) => {
  try {
    // Get the socket ID from the request (you might need to store it when the user connects)
    const socketId = req.user.socketId; // Example: retrieve the socketId from the user object

    if (socketId) {
      // Disconnect the socket
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true); // Forcefully disconnect the socket
      }
    }

    // Optionally, handle blacklisting the token here

    res.json({ message: "Logged out successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

// emailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: 'Gmail', // You can use any email service
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS, // Your email password or app password
  },
});

const sendConfirmationEmail = async (email, username, code) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Confirmation Code",
    text: `Hello ${username},\n\nYour confirmation code is: ${code}\n\nPlease enter this code to verify your email.`,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendConfirmationEmail };

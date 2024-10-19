const checkEmailConfirmed = (req, res, next) => {
    if (!req.user || req.user.isEmailConfirmed) {
      return res.status(403).json({ message: "Email not confirmed. Please confirm your email." });
    }
    next();
  };
  
  module.exports = checkEmailConfirmed;
  
const express = require("express");
const router = express.Router();
const passport = require("passport");

// User login endpoint
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Authentication Error:", err); // Detailed server-side logging for debugging
      return res
        .status(500)
        .json({
          success: false,
          message: "Internal server error. Please try again later.",
        });
    }

    if (!user) {
      // If user is not found or authentication failed
      return res
        .status(401)
        .json({
          success: false,
          message: info.message || "Invalid credentials.",
        });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error("Login Error:", err); // Log the error for debugging
        return res
          .status(500)
          .json({
            success: false,
            message: "Failed to log in. Please try again later.",
          });
      }

      // Successful login
      req.flash("success_msg", "Logged in successfully!");

      // Send success response along with the user details (you can customize what user data to send)
      return res.status(200).json({
        success: true,
        message: "Logged in successfully!",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    });
  })(req, res, next);
});

module.exports = router;

// routes/userRoutes.js
const express = require("express");
const User = require("../models/User");
const router = express.Router();
const isAuthenticated = require("../middleware/authMiddleware"); // Middleware to check authentication

// Follow a user
router.post("/follow/:userId", isAuthenticated, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.userId);

    // Check if the user to follow exists
    if (!userToFollow) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const user = req.user; // Authenticated user

    // Prevent self-following
    if (user._id.equals(userToFollow._id)) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot follow yourself." });
    }

    // Check if the user is already following the other user
    if (user.following.includes(userToFollow._id)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You are already following this user.",
        });
    }

    // Add the user to the following list and update the followers list
    user.following.push(userToFollow._id);
    userToFollow.followers.push(user._id);

    // Save both user documents
    await user.save();
    await userToFollow.save();

    res
      .status(200)
      .json({ success: true, message: "Successfully followed the user." });
  } catch (error) {
    console.error("Error following user:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// Unfollow a user
router.post("/unfollow/:userId", isAuthenticated, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.userId);

    // Check if the user to unfollow exists
    if (!userToUnfollow) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const user = req.user; // Authenticated user

    // Check if the user is already not following the other user
    if (!user.following.includes(userToUnfollow._id)) {
      return res
        .status(400)
        .json({ success: false, message: "You are not following this user." });
    }

    // Remove the user from the following list and update the followers list
    user.following = user.following.filter(
      (id) => id.toString() !== userToUnfollow._id.toString(),
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      (id) => id.toString() !== user._id.toString(),
    );

    // Save both user documents
    await user.save();
    await userToUnfollow.save();

    res
      .status(200)
      .json({ success: true, message: "Successfully unfollowed the user." });
  } catch (error) {
    console.error("Error unfollowing user:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

module.exports = router;

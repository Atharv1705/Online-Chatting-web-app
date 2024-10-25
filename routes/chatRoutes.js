const express = require("express");
const Message = require("../models/Chat"); // Assuming Chat is the correct model for messages
const router = express.Router();
const isAuthenticated = require("../middleware/authMiddleware"); // Middleware to check authentication

// Fetch chat messages between the authenticated user and the recipient, with pagination support
router.get("/messages/:recipient", isAuthenticated, async (req, res) => {
  try {
    const { username } = req.user; // Extract the username from the authenticated user
    const { recipient } = req.params; // Get the recipient from the request parameters
    const { limit = 20, skip = 0 } = req.query; // Pagination: limit and skip with default values

    // Validate that the recipient is not the same as the user
    if (username === recipient) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot message yourself." });
    }

    // Find messages between the authenticated user and recipient with pagination
    const messages = await Message.find({
      $or: [
        { user: username, recipient },
        { user: recipient, recipient: username },
      ],
    })
      .sort({ timestamp: 1 }) // Sort messages by timestamp in ascending order
      .limit(parseInt(limit)) // Limit the number of results
      .skip(parseInt(skip)); // Skip the first 'skip' results

    // If no messages are found
    if (messages.length === 0) {
      return res
        .status(204)
        .json({ success: true, message: "No messages found.", messages: [] });
    }

    // Send success response with the found messages
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    // Send error response with appropriate message
    res
      .status(500)
      .json({
        success: false,
        message: "Server error while fetching messages.",
      });
  }
});

module.exports = router;

// models/chat.js
const mongoose = require("mongoose");

// Define the message schema
const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  message: { type: String, required: true },
  recipient: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});

// Export the message model
const Message = mongoose.model("Message", messageSchema);
module.exports = Message;

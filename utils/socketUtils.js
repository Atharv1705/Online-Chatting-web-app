// utils/socketUtils.js
const userSockets = new Map(); // Use a Map to store user sockets

const registerUserSocket = (socket, username) => {
  if (!socket || !username) {
    console.error("Socket or username not provided");
    return;
  }

  socket.username = username; // Save the username to the socket object
  userSockets.set(username, socket); // Associate username with socket
  console.log(`User ${username} registered with socket ID: ${socket.id}`);
};

const removeUserSocket = (socket) => {
  if (socket && socket.username) {
    if (userSockets.has(socket.username)) {
      userSockets.delete(socket.username); // Remove user from userSockets on disconnect
      console.log(`User ${socket.username} disconnected and removed`);
    } else {
      console.log(`User ${socket.username} not found in userSockets`);
    }
  }
};

const sendMessageToRecipient = (data) => {
  if (!data || !data.recipient || !data.message) {
    console.error("Invalid message data provided");
    return;
  }

  if (userSockets.has(data.recipient)) {
    const recipientSocket = userSockets.get(data.recipient);
    recipientSocket.emit("receiveMessage", data); // Send message to specific user
    console.log(`Message sent to ${data.recipient}`);
  } else {
    console.log(`Recipient ${data.recipient} is not connected`);
  }
};

module.exports = {
  registerUserSocket,
  removeUserSocket,
  sendMessageToRecipient,
};

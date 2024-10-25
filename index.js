require("dotenv").config(); // Load environment variables
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

// Initialize app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Use environment variables for MongoDB connection
const mongoUri =
  process.env.MONGO_URI || "mongodb://localhost:27017/modern_chat_app";

// Connect to MongoDB
mongoose
  .connect(mongoUri)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Define schemas and models for users and chat messages
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String },
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  followRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  notifications: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      message: { type: String },
      timestamp: { type: Date, default: Date.now },
      isRead: { type: Boolean, default: false },
    },
  ],
});

const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  message: { type: String, required: true },
  recipient: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false },
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// Middleware for session handling
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 * 60 }, // 1-hour session expiry
  }),
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Flash message middleware handling JSON and HTML responses
function handleFlashMessages(req, res, next) {
  res.handleFlashMessages = (successMessage, errorMessage, redirectUrl) => {
    if (req.xhr || req.accepts("json")) {
      if (successMessage) {
        return res.status(200).json({ success: true, message: successMessage });
      } else if (errorMessage) {
        return res.status(400).json({ success: false, message: errorMessage });
      }
    } else {
      if (successMessage) {
        req.flash("success_msg", successMessage);
      } else if (errorMessage) {
        req.flash("error_msg", errorMessage);
      }
      return res.redirect(redirectUrl);
    }
  };
  next();
}

// Use the middleware
app.use(handleFlashMessages);

// Make flash messages available in all templates
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.user; // Expose user data to templates
  next();
});

// Passport configuration for authentication
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username });
      if (!user) return done(null, false, { message: "Incorrect username." });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return done(null, false, { message: "Incorrect password." });

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Serve the login page at the root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Home route (protected)
app.get("/home", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error_msg", "You must log in to view that resource.");
  res.redirect("/"); // Redirect to login page if not authenticated
}

// Validation functions
const validateUsername = (username) => {
  const usernameRegex =
    /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?!.*\s)[A-Za-z\d!@#$%^&*_]{3,}$/;
  return usernameRegex.test(username);
};

const validatePassword = (password) => {
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
  return passwordRegex.test(password);
};

// User registration with validation
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many accounts created from this IP, please try again later.",
});

app.post("/register", registrationLimiter, async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.handleFlashMessages(
      null,
      "All fields are required",
      "/register",
    );
  }

  try {
    const trimmedUsername = username.trim();
    const existingUser = await User.findOne({
      $or: [{ username: trimmedUsername }, { email }],
    });
    if (existingUser) {
      return res.handleFlashMessages(
        null,
        "Username or email already exists",
        "/register",
      );
    }

    if (!validateUsername(trimmedUsername)) {
      return res.handleFlashMessages(
        null,
        "Invalid username format.",
        "/register",
      );
    }

    if (!validatePassword(password)) {
      return res.handleFlashMessages(
        null,
        "Invalid password format.",
        "/register",
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username: trimmedUsername,
      email,
      password: hashedPassword,
    });
    await newUser.save();
    return res.handleFlashMessages(
      "Registration successful! Please log in.",
      null,
      "/login",
    );
  } catch (error) {
    console.error("Registration error:", error);
    return res.handleFlashMessages(
      null,
      `Server error during registration: ${error.message}`,
      "/register",
    );
  }
});

// User login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: "Too many login attempts, please try again later.",
});

app.post("/api/auth/login", loginLimiter, (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err)
      return res.status(500).json({ success: false, message: "Server error." });
    if (!user)
      return res.status(401).json({ success: false, message: info.message });

    req.logIn(user, (err) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, message: "Server error." });
      res
        .status(200)
        .json({
          success: true,
          message: "Logged in successfully.",
          redirectUrl: "/home",
        });
    });
  })(req, res, next);
});

// Logout endpoint
app.get("/logout", (req, res) => {
  req.logout();
  req.flash("success_msg", "You have successfully logged out.");
  res.redirect("/"); // Redirect to the root URL (login page)
});

// User profile and settings
app.get("/settings", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password"); // Exclude password
    if (!user) return res.status(404).send("User not found.");

    res.json({
      username: user.username,
      email: user.email,
      bio: user.bio,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      followRequestsCount: user.followRequests.length,
      notificationsCount: user.notifications.filter((n) => !n.isRead).length,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching user data." });
  }
});

// Socket.io integration for chat functionality
io.on("connection", (socket) => {
  console.log("New client connected");

  // Listen for chat messages from the client
  socket.on("chat message", async (msgData) => {
    const { user, message, recipient } = msgData;
    const newMessage = new Message({ user, message, recipient });
    await newMessage.save();

    // Emit message to the recipient
    io.emit("chat message", {
      user,
      message,
      recipient,
      timestamp: newMessage.timestamp,
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

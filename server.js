require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendSOSAlert = require("./models/SOSAlert");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ MongoDB Connection Error:", err));

// Import Models
const User = require("./models/User");

// Default Route
app.get("/", (req, res) => {
    res.send("✅ Emergency SOS Server is Running!");
});

// User Registration
app.post("/register", async (req, res) => {
    try {
        const { name, email, password, emergencyContacts } = req.body;

        if (!name || !email || !password || !emergencyContacts || emergencyContacts.length === 0) {
            return res.status(400).json({ error: "All fields, including emergency contacts, are required." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, emergencyContacts });
        await newUser.save();

        res.status(201).json({ message: "✅ User registered successfully!" });
    } catch (error) {
        console.error("❌ Registration Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// User Login
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.status(200).json({ message: "✅ Login successful!", token });
    } catch (error) {
        console.error("❌ Login Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Send SOS Alert to Emergency Contacts
app.post("/send-sos", async (req, res) => {
    try {
        const { email, latitude, longitude } = req.body;
        if (!email || !latitude || !longitude) {
            return res.status(400).json({ error: "Email and location are required." });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Send SOS alert to all emergency contacts
        const response = await sendSOSAlert(user.emergencyContacts, latitude, longitude);

        if (response.success) {
            res.status(201).json({ message: "✅ SOS Alert Sent to Emergency Contacts!" });
        } else {
            res.status(500).json({ error: "Failed to send SOS alerts." });
        }

    } catch (error) {
        console.error("❌ Error sending SOS alert:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

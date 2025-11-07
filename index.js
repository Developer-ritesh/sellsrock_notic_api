const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const WebSocket = require("ws");
const mongoose = require("mongoose");

// ===============================
// 🔗 MongoDB Connection
// ===============================
const uri =
  "mongodb+srv://ravi:7OWFqQtQpXLzWCE5@cluster0.mkeur.mongodb.net/order_notifications?retryWrites=true&w=majority";

async function connectDB() {
  try {
    await mongoose.connect(uri);
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}

connectDB();

// ===============================
// 📦 Mongoose Model
// ===============================
const Notification = mongoose.model(
  "Notification",
  new mongoose.Schema({
    order_id: Number,
    user_name: String,
    total: Number,
    created_at: { type: Date, default: Date.now },
  })
);

// ===============================
// ⚙️ Express Setup
// ===============================
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===============================
// 🌐 HTTP + WebSocket on Same Port
// ===============================
const PORT = 6002;
const server = app.listen(PORT, () =>
  console.log(`🌐 HTTP & WS server running on http://localhost:${PORT}`)
);

const wss = new WebSocket.Server({ server });
console.log(`✅ WebSocket initialized on ws://localhost:${PORT}`);

// ===============================
// 🔊 Broadcast Helper
// ===============================
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ===============================
// 📬 Routes
// ===============================

// Create + Broadcast new event
app.post("/send", async (req, res) => {
  try {
    const { event, data } = req.body;

    if (!event || !data) {
      return res.status(400).json({ success: false, message: "Invalid body" });
    }

    if (event === "order_created") {
      await Notification.create({
        order_id: data.id,
        user_name: data.user,
        total: data.total,
      });
    }

    broadcast({ event, data });
    console.log("📢 Broadcasted:", event, data);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error in /send:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Fetch all notifications
app.get("/notifications", async (req, res) => {
  try {
    const list = await Notification.find().sort({ created_at: -1 });
    res.json(list);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete single notification
app.delete("/notifications/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Notification.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    console.log(`🗑️ Deleted notification ID: ${id}`);
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("❌ Error deleting notification:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete multiple notifications
app.post("/notifications/delete-multiple", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids)) {
      return res
        .status(400)
        .json({ success: false, message: "IDs array required" });
    }

    const result = await Notification.deleteMany({ _id: { $in: ids } });
    console.log(`🗑️ Deleted ${result.deletedCount} notifications`);

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: "Notifications deleted",
    });
  } catch (err) {
    console.error("❌ Error in bulk delete:", err);
    res.status(500).json({ error: "Server error" });
  }
});

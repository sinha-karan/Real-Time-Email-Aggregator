const express = require("express");
const { startImapSync } = require("./services/emailSync");

const app = express();
const PORT = process.env.PORT || 3000;

// Start email synchronization when the server starts
app.listen(PORT, () => {
  console.log(`ReachInbox assignment server is running on port ${PORT}`);
  startImapSync();
});


app.get("/", (req, res) => {
  res.send("Welcome to ReachInbox Assignment Backend!");
});
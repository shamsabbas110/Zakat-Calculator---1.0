require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { initCron } = require('./utils/cronJob');

// Define the port. Use the one from the .env file, or default to 5000
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB().then(() => {
  // Initialize Cron Job after successful DB connection
  initCron();
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

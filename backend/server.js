require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

// Define the port. Use the one from the .env file, or default to 5000
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

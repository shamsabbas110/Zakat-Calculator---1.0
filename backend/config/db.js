const mongoose = require('mongoose');

// This function connects our backend to the MongoDB database
const connectDB = async () => {
  try {
    // Attempt to connect using the URI from our .env file
    // We use process.env.MONGO_URI to keep the connection string secret
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`Connected to Database`);
  } catch (error) {
    // If there is an error, log it and exit the process
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1); 
  }
};

module.exports = connectDB;

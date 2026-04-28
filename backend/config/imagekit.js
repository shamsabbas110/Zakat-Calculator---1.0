const ImageKit = require('imagekit');
require('dotenv').config();

// Initialize ImageKit with our credentials from the .env file
// This setup allows us to upload images directly to our ImageKit account
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

module.exports = imagekit;

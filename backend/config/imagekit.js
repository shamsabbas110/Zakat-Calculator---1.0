const ImageKit = require('imagekit');
require('dotenv').config();

let imagekit = null;

// Initialize ImageKit only if credentials are provided in .env
if (
  process.env.IMAGEKIT_PUBLIC_KEY &&
  process.env.IMAGEKIT_PRIVATE_KEY &&
  process.env.IMAGEKIT_URL_ENDPOINT
) {
  imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
  });
} else {
  // Graceful fallback mock if credentials are not set
  imagekit = {
    upload: async () => {
      throw new Error("ImageKit is not configured. Please set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT in .env");
    }
  };
}

module.exports = imagekit;

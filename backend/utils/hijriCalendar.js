const axios = require('axios');

// Function to get the current Hijri year from an external API
const getCurrentHijriYear = async () => {
  try {
    // Get today's date in DD-MM-YYYY format
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
    const yyyy = today.getFullYear();
    const formattedDate = `${dd}-${mm}-${yyyy}`;

    // Call the free AlAdhan API to convert Gregorian to Hijri
    const response = await axios.get(`http://api.aladhan.com/v1/gToH?date=${formattedDate}`);
    
    // Extract the Hijri year from the API response
    const currentHijriYear = response.data.data.hijri.year;
    
    return parseInt(currentHijriYear);
  } catch (error) {
    console.error("Error fetching Hijri calendar data:", error.message);
    // Fallback if the API is down: rough calculation (Gregorian - 579 is approximately the Hijri year)
    const currentGregorianYear = new Date().getFullYear();
    return currentGregorianYear - 579; 
  }
};

module.exports = { getCurrentHijriYear };

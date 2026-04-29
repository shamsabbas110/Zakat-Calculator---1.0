const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const PastRate = require('./models/PastRate');

dotenv.config({ path: path.join(__dirname, '.env') });

const myMonths = ["Muharram", "Safar", "Rabi' al-awwal", "Rabi' al-thani", "Jumada al-ula", "Jumada al-akhira", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];

async function verifyAll() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");
        
        for (const m of myMonths) {
            const found = await PastRate.findOne({ hijriDate: new RegExp(m, "i") });
            console.log(`${m}: ${found ? 'FOUND (' + found.hijriDate + ')' : 'NOT FOUND'}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verifyAll();

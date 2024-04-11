const mongoose = require("mongoose")
require('dotenv').config();
const cron = require("node-cron");


mongoose.connect(process.env.MONGODB_URL)
.then(() => {
    console.log("MongoDB Connected.")
})
.catch((error) => {
    console.log("Failed", error)
})

const newUser = new mongoose.Schema({
    fullname:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },
    mobilenum:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    verificationCode:{
        type:String,
        required:true
    },
    IsVerified:{
        type:Boolean,
        required:true
    }
})


const parkingSlotSchema = new mongoose.Schema({
    name: { type: String, required: true },
    schedule: [{ type: String }] // CRON schedule for each parking slot
});

const ParkingSlot1 = mongoose.model('ParkingSlot', parkingSlotSchema);

// Function to generate CRON schedules for each parking slot
function generateParkingSchedules() {
    const parkingSlots = [
        "A01", "A02", "A03",
        "A04", "A05", "A06",
        "A07", "A08", "A09",
        "A10", "B01", "B02", 
        "B03", "B04", "B05", 
        "B06", "B07", "B08", 
        "B09", "B10",
    ];

    const cronSchedules = [];
    const cronPattern = '0 0 */1 * *'; // Run every hour

    // Generate CRON schedule for each parking slot for 24 hours
    parkingSlots.forEach(slot => {
        const schedule = `${cronPattern}`;
        cronSchedules.push(schedule);
    });

    return cronSchedules;
}

// Function to initialize parking slots in the database
async function initializeParkingSlots() {
    const parkingSlots = [
        "A01", "A02", "A03",
        "A04", "A05", "A06",
        "A07", "A08", "A09",
        "A10", "B01", "B02", 
        "B03", "B04", "B05", 
        "B06", "B07", "B08", 
        "B09", "B10",
    ];

    const schedules = generateParkingSchedules();

    try {
        // Clear existing parking slots
        await ParkingSlot1.deleteMany();

        // Initialize parking slots
        const slots = parkingSlots.map((slot, index) => ({
            name: slot,
            schedule: [schedules[index]] // Assign the schedule for each slot
        }));

        // Insert parking slots into the database
        await ParkingSlot1.insertMany(slots);

        console.log("Parking slots initialized successfully.");
    } catch (error) {
        console.error("Error initializing parking slots:", error);
    }
}

//initializeParkingSlots();

// Initialize parking slots at 00:00 AM every day
cron.schedule('0 0 * * *', () => {
    initializeParkingSlots();
}, {
    timezone: "Asia/Kolkata" // Adjust timezone as per your requirement
});

const bookingSchema = new mongoose.Schema({
    email: { type: String, required: true },
    slot: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    carNumber: { type: String, required: true },
    status: { type: String, required: true },
});


const Users = mongoose.model("Users", newUser)
const ParkingSlot = mongoose.model('ParkingSlot', parkingSlotSchema);
const Booking = mongoose.model('Booking', bookingSchema);

module.exports = {
    Users,
    ParkingSlot,
    Booking
}
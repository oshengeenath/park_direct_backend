const mongoose = require("mongoose");
require("dotenv").config();
const cron = require("node-cron");

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("MongoDB Connected.");
  })
  .catch((error) => {
    console.log("Failed", error);
  });

const newUser = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  mobilenum: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  verificationCode: {
    type: String,
    required: true,
  },
  IsVerified: {
    type: Boolean,
    required: true,
  },
  userRole: {
    type: String,
    required: true,
  },
  resetToken: { type: String, required: true },
  resetTokenExpiry: { type: String, required: true },
});

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true },
  email: { type: String, required: true },
  date: { type: String, required: true },
  arrivalTime: { type: String, required: true },
  leaveTime: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  status: { type: String, required: true },
  parkingSlotId: { type: String, required: true },
});

const parkingSlotSchema = new mongoose.Schema({
  slotId: { type: String, required: true, unique: true },
  status: { type: String, required: true, enum: ["available", "booked"] },
  bookingId: { type: String, reuired: true },
});

const Users = mongoose.model("Users", newUser);
const Booking = mongoose.model("Booking", bookingSchema);
const ParkingSlot = mongoose.model("ParkingSlot", parkingSlotSchema);

module.exports = {
  Users,
  Booking,
  ParkingSlot,
};

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { MongoClient, ObjectId } = require("mongodb");
const mongoose = require("mongoose");
const { Users, ParkingSlot, Booking } = require("./mongo");

app.use(bodyParser.json());
app.listen(8000, () => console.log("Server Up and running"));

// Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 587,
  secure: false,
  auth: {
    user: process.env.USERNAME, // sender gmail address
    pass: process.env.PASSWORD, // app password from gmail account
  },
});

// ##########################################
// ----------------- AUTH -------------------
// ##########################################

// Send Email Address
app.post("/auth/send-verification-email", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user already exists with the provided email
    const existingUser = await Users.findOne({ email });
    // If user already exists, return an error
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }
    // Create a verification code (you can use a library for generating codes)
    const verificationCode = generateVerificationCode();

    const fullname = "fullname";
    const mobilenum = "mobilenum";
    const password = "password";
    const IsVerified = false;
    const userRole = "vehicleOwner";
    const resetToken = "resetToken";
    const resetTokenExpiry = "resetTokenExpiery";

    // Create a new user instance
    const user = new Users({
      fullname,
      email,
      mobilenum,
      password,
      verificationCode,
      IsVerified,
      userRole,
      resetToken,
      resetTokenExpiry,
    });

    await sendVerificationEmail(email, verificationCode);
    // Save the user to the database
    await user.save();
    // Return success response
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    // Handle any errors that occur during registration
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Verify Email Address
app.post("/auth/verify-email", async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    // Find the user with the provided email and verification code
    const user = await Users.findOne({ email, verificationCode });
    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found or verification code is incorrect" });
    }
    // Update the Is_Verified field to true
    user.IsVerified = true;
    await user.save();
    // Return success response
    res.json({ message: "Verification successful. User is now verified." });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Register User
app.put("/auth/register-user", async (req, res) => {
  try {
    const { email, fullname, mobilenum, password } = req.body;

    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (fullname) {
      user.fullname = fullname;
    }
    if (mobilenum) {
      user.mobilenum = mobilenum;
    }
    if (password) {
      user.password = password;
    }
    await user.save();
    res.status(200).json({ message: "User details updated successfully" });
  } catch (error) {
    console.error("Error updating user details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login Route
app.post("/auth/login-user", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.password !== password) {
      return res.status(401).json({ error: "Incorrect password" });
    }
    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Forgot Password
app.put("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // Token expires in 1 hour
    // Update user document with reset token and expiry time
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;

    await user.save();

    // Send email with reset link
    await sendResetEmail(email, resetToken);

    res
      .status(200)
      .json({ message: "Reset code sent to your email successfully" });
  } catch (error) {
    console.error("Error sending reset code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset Password
app.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Check if reset token is valid and not expired
    if (user.resetToken !== resetToken || user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    // Update user password
    user.password = newPassword;
    // Clear reset token and expiry
    user.resetToken = "resetToken";
    user.resetTokenExpiry = "resetTokenExpiry";
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ##########################################
// ------------- AUTH METHODS ---------------
// ##########################################

function generateVerificationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function sendVerificationEmail(email, verificationCode) {
  // Mail Options
  const mailOptions = {
    from: {
      name: "Park Direct",
      address: process.env.USERNAME,
    },
    to: email,
    subject: "Account Verification",
    text: `Your verification code is: ${verificationCode}`,
  };
  await transporter.sendMail(mailOptions);
}

function generateResetToken() {
  return Math.random().toString(36).substring(2, 10);
}

async function sendResetEmail(email, resetToken) {
  // Mail Options
  const mailOptions = {
    from: {
      name: "Park Direct",
      address: process.env.USERNAME,
    },
    to: email,
    subject: "Account Verification",
    text: `Your verification code is: ${resetToken}`,
  };
  await transporter.sendMail(mailOptions);
}

// ##########################################
// -------------- BOOKINGS ------------------
// ##########################################

// Part 1: for vehicleOwner

app.post("/vehicleOwner/book-slot", async (req, res) => {
  const { bookingId, email, date, arrivalTime, leaveTime, vehicleNumber } =
    req.body;

  try {
    // Check if a booking already exists for the specified date and start time for any vehicle
    const existingBooking = await Booking.findOne({
      date,
      arrivalTime,
      leaveTime,
      vehicleNumber,
    });

    if (existingBooking) {
      return res.status(400).json({
        error:
          "This vehicle already has a booking for the specified date and time.",
      });
    }
    const status = "pending";

    // Since there's no need to check individual slots, directly save booking details
    const newBooking = await Booking.create({
      bookingId,
      email,
      date,
      arrivalTime,
      leaveTime,
      vehicleNumber,
      status,
    });

    return res.json({
      message: "Slot booked successfully.",
      booking: newBooking,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// Retrieve all bookings for a specific email address
app.get("/vehicleOwner/get-all-bookings/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const bookings = await Booking.find({ email });
    return res.json(bookings);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// Part 2: for officer

app.get("/officer/fetch-all-pending-requests", async (req, res) => {
  try {
    // Fetch all bookings where the status is 'pending'
    const pendingBookings = await Booking.find({ status: "pending" });
    res.json(pendingBookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/officer/confirm-booking-request", async (req, res) => {
  const { bookingId, parkingSlotId } = req.body;

  try {
    // Optional: Verify the parking slot is available before assigning
    const parkingSlot = await ParkingSlot.findById(parkingSlotId);
    if (!parkingSlot) {
      return res.status(404).json({ error: "Parking slot not found" });
    }

    // You might want to add additional checks here to ensure the slot is not already taken


    // Find the booking by ID and update its status to 'confirmed' along with assigning the parking slot
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: "confirmed",
        parkingSlot: parkingSlotId, // Assuming your Booking model has a field for parkingSlot
      },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Optional: Update the parking slot status to indicate it's now taken
    // This depends on how your ParkingSlot model is structured and if you track availability

    res.json({
      message: "Booking confirmed and parking slot assigned successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/officer/fetch-all-confirmed-bookings", async (req, res) => {
  try {
    // Fetch all bookings where the status is 'confirmed'
    const confirmedBookings = await Booking.find({ status: "confirmed" });
    res.json(confirmedBookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const { MongoClient, ObjectId } = require("mongodb");
const mongoose = require("mongoose");
const { Users, ParkingSlot, Booking } = require("./mongo");
const { startScheduledTasks } = require("./scheduler");

app.use(bodyParser.json());
app.listen(8000, () => console.log("Server Up and running"));

startScheduledTasks();

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 587,
  secure: false,
  auth: {
    user: process.env.USERNAME,
    pass: process.env.PASSWORD,
  },
});

app.post("/auth/send-verification-email", async (req, res) => {
  try {
    const { email } = req.body;

    const existingUser = await Users.findOne({ email });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    const verificationCode = generateVerificationCode();

    const fullname = "fullname";
    const mobilenum = "mobilenum";
    const password = "password";
    const IsVerified = false;
    const userRole = "vehicleOwner";
    const resetToken = "resetToken";
    const resetTokenExpiry = "resetTokenExpiery";

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

    await user.save();

    res.status(201).json({ message: "Verification code sent successfully" });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/auth/verify-email", async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    const user = await Users.findOne({ email, verificationCode });

    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found or verification code is incorrect" });
    }

    user.IsVerified = true;
    await user.save();

    res.json({ message: "Verification successful. User is now verified." });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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

    const userResponse = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      mobilenum: user.mobilenum,

      IsVerified: user.IsVerified,
      userRole: user.userRole,
    };

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res
      .status(200)
      .json({ user: userResponse, token, message: "Login successful" });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;

    await user.save();

    await sendResetEmail(email, resetToken);

    res
      .status(200)
      .json({ message: "Reset code sent to your email successfully" });
  } catch (error) {
    console.error("Error sending reset code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.resetToken !== resetToken || user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    user.password = newPassword;

    user.resetToken = "resetToken";
    user.resetTokenExpiry = "resetTokenExpiry";
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

function generateVerificationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function sendVerificationEmail(email, verificationCode) {
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

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, "4f3c2a17753c23a3b6f9e2a9b841c061d6a8d5ea", (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post("/vehicleOwner/book-slot", authenticateToken, async (req, res) => {
  const { bookingId, email, date, arrivalTime, leaveTime, vehicleNumber } =
    req.body;

  try {
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
    const parkingSlotId = "parkingSlotId";

    const newBooking = await Booking.create({
      bookingId,
      email,
      date,
      arrivalTime,
      leaveTime,
      vehicleNumber,
      status,
      parkingSlotId,
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

app.get("/officer/fetch-all-pending-requests", async (req, res) => {
  try {
    const pendingBookings = await Booking.find({ status: "pending" });
    res.json(pendingBookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/officer/fetch-all-confirmed-bookings", async (req, res) => {
  try {
    const confirmedBookings = await Booking.find({ status: "confirmed" });
    res.json(confirmedBookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/officer/confirm-booking-request", async (req, res) => {
  const { bookingId, parkingSlotId } = req.body;

  try {
    const parkingSlot = await ParkingSlot.findOne({
      slotId: parkingSlotId,
      status: "available",
    });

    if (!parkingSlot) {
      return res
        .status(400)
        .json({ error: "Parking slot not found or is already booked" });
    }

    const updatedBooking = await Booking.findOneAndUpdate(
      { bookingId: bookingId },
      {
        status: "confirmed",
        parkingSlotId: parkingSlotId,
      },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    await ParkingSlot.findOneAndUpdate(
      { slotId: parkingSlotId },
      {
        status: "booked",
        bookingId: bookingId,
      },
      { new: true }
    );

    res.json({
      message: "Booking confirmed and parking slot assigned successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

function getFormattedDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();

  return `${year}-${month}-${day}`;
}

app.get("/officer/today-arrivals", async (req, res) => {
  try {
    const todayDate = getFormattedDate();

    const todayArraivals = await Booking.find({ date: todayDate });
    res.json(todayArraivals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/admin/add-parking-slots", async (req, res) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    for (let i = 1; i <= 45; i++) {
      const slotIdA = `S${i}`;
      const newSlotA = new ParkingSlot({
        slotId: slotIdA,
        status: "available",
        bookingId: "bookingId",
      });
      await newSlotA.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).send("Parking slots added successfully.");
  } catch (error) {
    console.error("Error adding parking slots:", error);
    res.status(500).send("Failed to add parking slots.");
  }
});

app.get("/officer/all-parking-slots", async (req, res) => {
  try {
    const parkingSlots = await ParkingSlot.find({});

    if (parkingSlots.length === 0) {
      return res.status(404).json({ error: "No parking slots found" });
    }

    res.json(parkingSlots);
  } catch (error) {
    console.error("Error fetching all parking slots:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

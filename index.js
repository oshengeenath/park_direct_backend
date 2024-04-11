const express = require("express")
const app = express()
const bodyParser = require("body-parser"); // Require body-parser
const nodemailer = require('nodemailer')
const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const {Users, ParkingSlot, Booking} = require("./mongo")

app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
    service:'gmail',
    // auth: {
    //     user : process.env.SEND_EMAIL,
    //     pass:process.env.APP_PASSWORD
    // }
    auth: {
        user : 'toptopw05@gmail.com',
        pass: 'detf efbi xanu yily'
    }
});


// Send Email Address
app.post('/sendemail', async (req, res) => {
    try {
        const { email } = req.body;

        // Check if user already exists with the provided email
        const existingUser = await Users.findOne({ email });

        // If user already exists, return an error
        if (existingUser) {
            return res.status(400).json({ error: "User with this email already exists" });
        }

        // Create a verification code (you can use a library for generating codes)
        const verificationCode = generateVerificationCode();

        const IsVerified = false
        const fullname = 'fullname'
        const password = 'password'
        const mobilenum = 'mobilenum'

        // Create a new user instance
        const user = new Users({ fullname, email, password, mobilenum,verificationCode, IsVerified });

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
app.post('/verify', async (req, res) => {
    const { email, verificationCode } = req.body;

    try {
        // Find the user with the provided email and verification code
        const user = await Users.findOne({ email, verificationCode });

        if (!user) {
            return res.status(404).json({ error: "User not found or verification code is incorrect" });
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
app.put('/register', async (req, res) => {
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
app.post('/login', async (req, res) => {
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
app.post('/forgotpassword', async (req, res) => {
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

        res.status(200).json({ message: "Reset link sent successfully" });
    } catch (error) {
        console.error("Error sending reset link:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Reset Password
app.post('/resetpassword', async (req, res) => {
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
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();

        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


// Retrieve booking details for a specific email
app.get('/getuserdetails/:email', async (req, res) => {
    const { email } = req.params;

    try {
        const userdetails = await Users.findOne({ email }, 'fullname email mobilenum');

        return res.json(userdetails);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// Booking API
app.post('/book-slot', async (req, res) => {
    const { email, slot, date, startTime, carNumber } = req.body;

    try {
        // Check if a booking already exists for the specified slot, date, and start time
        const existingBooking = await Booking.findOne({ slot, date, startTime });

        if (existingBooking) {
            return res.status(400).json({ error: 'Slot already booked for the specified date and time.' });
        }

        // Find the parking slot by name
        const parkingSlot = await ParkingSlot.findOne({ name: slot });

        if (!parkingSlot) {
            return res.status(400).json({ error: 'Invalid slot number. Please provide a valid slot number.' });
        }

        // Calculate the index of the start time slot based on startTime
        const startTimeIndex = Math.floor((new Date(`${date}T${startTime}`).getTime() - new Date(`${date}T00:00`).getTime()) / (1000 * 60 * 30));

        // Check if the slot is available for the duration (59 minutes onward)
        for (let i = startTimeIndex; i < startTimeIndex + 2; i++) { // Loop for 2 slots (59 minutes)
            if (parkingSlot.schedule[i] === 'booked') {
                return res.status(400).json({ error: 'Slot already booked at the specified time.' });
            }
        }

        // Mark the slots as booked for the duration (59 minutes onward)
        for (let i = startTimeIndex; i < startTimeIndex + 2; i++) { // Loop for 2 slots (59 minutes)
            parkingSlot.schedule[i] = 'booked'; // Mark the slot as booked
        }
        await parkingSlot.save(); // Save the updated slot

        const status = 'pending'

        // Save booking details in the "bookings" collection
        await Booking.create({ email, status, slot, date, startTime, carNumber, status });

        return res.json({ message: 'Slot booked successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});


// Retrieve booking details for a specific email
app.get('/bookings/:email', async (req, res) => {
    const { email } = req.params;

    try {
        const bookings = await Booking.find({ email });

        return res.json(bookings);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});


// Other Functions

// Function to send verification email
async function sendVerificationEmail(email, verificationCode) {
    const mailOptions = {
        from: 'toptopw05@gmail.com',
        to: email,
        subject: 'Account Verification',
        text: `Your verification code is: ${verificationCode}`
    };

    await transporter.sendMail(mailOptions);
}

// Generate a verification code
function generateVerificationCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Send reset password email
async function sendResetEmail(email, resetToken) {
     const mailOptions = {
         from: 'toptopw05@gmail.com',
         to: email,
         subject: 'Reset Password',
         text:`Your Reset Token is : ${resetToken}`
     }; 
     await transporter.sendMail(mailOptions);
 }

 // Generate a reset token
 function generateResetToken() {
     return Math.random().toString(36).substring(2, 10);
 }


app.listen(8000, () => console.log("Server Up and running"));
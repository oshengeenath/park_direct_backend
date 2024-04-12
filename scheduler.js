const cron = require("node-cron");
const { Booking, ParkingSlot } = require("./mongo");
const moment = require("moment"); // Using moment.js for easier date manipulation

function startScheduledTasks() {
  cron.schedule("* * * * *", async () => {
    console.log(
      "Running task to check for expired bookings and free up parking slots..."
    );
    const now = new Date();

    const bookings = await Booking.find({ status: "confirmed" }); // Get all confirmed bookings

    for (const booking of bookings) {
      // Combine booking date with leaveTime to create a full datetime object
      const leaveDateTime = moment(`${booking.date}`).set({
        hour: parseInt(booking.leaveTime.split(":")[0], 10),
        minute: parseInt(booking.leaveTime.split(":")[1], 10),
      });

      console.log(now);
      console.log(leaveDateTime);

      if (leaveDateTime.isBefore(moment(now))) {
        // Check if the booking has expired
        // Update the parking slot linked to this booking
        await ParkingSlot.updateOne(
          { slotId: booking.parkingSlotId },
          { $set: { status: "available", bookingId: "bookingId" } } // Make slot available again
        );

        // Optionally, update the booking status to 'completed'
        await Booking.updateOne(
          { bookingId: booking.bookingId },
          { $set: { status: "completed" } } // Mark booking as completed
        );
      }
    }
  });
}

module.exports = { startScheduledTasks };
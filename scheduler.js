const cron = require("node-cron");
const { Booking, ParkingSlot } = require("./mongo");
const moment = require("moment");

function startScheduledTasks() {
  cron.schedule("* * * * *", async () => {
    console.log(
      "Running task to check for expired bookings and free up parking slots..."
    );
    const now = new Date();

    const bookings = await Booking.find({ status: "confirmed" });

    for (const booking of bookings) {
      const leaveDateTime = moment(`${booking.date}`).set({
        hour: parseInt(booking.leaveTime.split(":")[0], 10),
        minute: parseInt(booking.leaveTime.split(":")[1], 10),
      });

      console.log(now);
      console.log(leaveDateTime);

      if (leaveDateTime.isBefore(moment(now))) {
        await ParkingSlot.updateOne(
          { slotId: booking.parkingSlotId },
          { $set: { status: "available", bookingId: "bookingId" } }
        );

        await Booking.updateOne(
          { bookingId: booking.bookingId },
          { $set: { status: "completed" } }
        );
      }
    }
  });
}

module.exports = { startScheduledTasks };

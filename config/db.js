const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and fill in your MongoDB Atlas connection string."
    );
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    // Modern mongoose (8.x) no longer needs useNewUrlParser/useUnifiedTopology,
    // they're the default behavior now.
  });

  console.log(`[db] Connected to MongoDB: ${mongoose.connection.name}`);

  mongoose.connection.on("error", (err) => {
    console.error("[db] MongoDB connection error:", err);
  });

  return mongoose.connection;
}

module.exports = connectDB;

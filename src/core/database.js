import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDatabase = async () => {
      try {
            mongoose.set("strictQuery", false);
                await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
                  serverSelectionTimeoutMS: 5000,
                  socketTimeoutMS: 5000,
                  bufferCommands: false,
                });
                    console.log("[INFO] Database connected successfully");
      } catch (error) {
            console.error("[WARNING] Failed to connect to MongoDB (continuing with in-memory fallback):", error);
                // Do not crash the bot if the database is unavailable.
                // The GatewayConfigService will continue with safe in-memory fallback.
      }
};

export default connectDatabase;

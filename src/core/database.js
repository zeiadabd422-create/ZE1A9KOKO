import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDatabase = async () => {
      try {
            mongoose.set("strictQuery", false);
                await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
                  serverSelectionTimeoutMS: 5000,
                });
                    console.log("[INFO] Database connected successfully");
      } catch (error) {
            console.error("[ERROR] Failed to connect to MongoDB:", error);
                process.exit(1);
      }
};

export default connectDatabase;

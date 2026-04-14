import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI as string, {});

    console.log(`MongoDB Connected: ${conn.connection.host}`.yellow.underline);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`.red.underline.bold);
    process.exit(1);
  }
};

export default connectDB;

import mongoose from 'mongoose';

let cachedConnection = null;

export async function connectDB() {
  if (cachedConnection && cachedConnection.readyState === 1) {
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside your deployment settings.');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    cachedConnection = conn.connection;
    console.log('Successfully connected to MongoDB');
    return cachedConnection;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    throw err;
  }
}

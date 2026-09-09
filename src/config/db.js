const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in the environment');
  }

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  // Enable optional debug logging when needed (set MONGOOSE_DEBUG=true)
  if (process.env.MONGOOSE_DEBUG === 'true') {
    mongoose.set('debug', true);
  }

  const connectOptions = {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 30000,
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 30000,
    socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
    family: 4, // prefer IPv4 to avoid dual-stack DNS issues
  };

  try {
    await mongoose.connect(uri, connectOptions);
  } catch (err) {
    console.error('Error during initial MongoDB connect:', err && err.stack ? err.stack : err);
    throw err;
  }
}

module.exports = connectDB;

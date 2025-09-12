const { MongoClient } = require('mongodb');

let db = null;
let client = null;

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();
    
    console.log(`MongoDB Connected: ${client.topology.s.options.hosts[0].host}`);
    
    // Initialize default API keys if none exist
    await initializeApiKeys();
  } catch (error) {
    console.error('Database connection error:', error);
    // Don't exit process in production, let app continue without DB
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

const initializeApiKeys = async () => {
  // API keys are now managed through user accounts via Discord OAuth
  // No need to initialize from environment variables
  console.log('API key management handled through user dashboard');
};

const getDB = () => db;
const getClient = () => client;

module.exports = { connectDB, getDB, getClient };

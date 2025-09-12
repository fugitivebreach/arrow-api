require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const connectDB = require('./config/database');

// Import passport configuration
require('./config/passport');
const passport = require('passport');

// Import routes
const robloxRoutes = require('./routes/roblox');
const { router: authRoutes } = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const webRoutes = require('./routes/web');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Arrow API'
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', webRoutes);

// API routes (for Roblox endpoints)
app.use('/', robloxRoutes);

// 404 handler
app.use('*', (req, res) => {
  // Check if it's an API request or web request
  if (req.path.startsWith('/api') || req.headers['api-key']) {
    res.status(404).json({
      error: 'Endpoint not found',
      availableEndpoints: [
        'GET /health - Health check',
        'GET /{robloxuserid}/{groupid} - Check group membership (requires api-key header)'
      ]
    });
  } else {
    // Render 404 page for web requests
    res.status(404).render('404', { 
      title: '404 - Page Not Found',
      user: req.user 
    });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (req.headers['api-key'] || req.path.startsWith('/api')) {
    res.status(500).json({
      error: 'Internal server error'
    });
  } else {
    res.status(500).render('error', {
      title: 'Error - Arrow API',
      error: process.env.NODE_ENV === 'development' ? error : {},
      user: req.user
    });
  }
});

app.listen(PORT, () => {
  console.log(`Arrow API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`Documentation: http://localhost:${PORT}/docs`);
});

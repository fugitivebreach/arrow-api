require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const { connectDB } = require('./config/database');

// Import passport configuration (only if Discord OAuth is configured)
let passport;
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  require('./config/passport');
  passport = require('passport');
}

// Import routes with error handling
let robloxRoutes, authRoutes, dashboardRoutes, webRoutes;
try {
  robloxRoutes = require('./routes/roblox');
  const authModule = require('./routes/auth');
  authRoutes = authModule.router;
  dashboardRoutes = require('./routes/dashboard');
  webRoutes = require('./routes/web');
  console.log('All routes loaded successfully');
} catch (error) {
  console.error('Error loading routes:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint FIRST - before any middleware
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Arrow API'
  });
});

// Connect to MongoDB (with error handling for Railway)
if (process.env.MONGODB_URI) {
  connectDB().catch(err => console.error('DB connection failed:', err));
} else {
  console.warn('MONGODB_URI not set, skipping database connection');
}

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
  store: process.env.MONGODB_URI ? MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }) : undefined,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware (only if configured)
if (passport) {
  app.use(passport.initialize());
  app.use(passport.session());
}

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes (only if loaded successfully)
if (authRoutes) app.use('/auth', authRoutes);
if (dashboardRoutes) app.use('/', dashboardRoutes);
if (webRoutes) app.use('/', webRoutes);
if (robloxRoutes) app.use('/', robloxRoutes);

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Arrow API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`Documentation: http://localhost:${PORT}/docs`);
  }
});

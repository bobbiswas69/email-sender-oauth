require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const { body, validationResult } = require('express-validator');
const xss = require('xss');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
})); // Adds various HTTP headers for security
app.use(xssClean()); // Prevent XSS attacks
app.use(hpp()); // Prevent HTTP Parameter Pollution mee mee pooo pooo

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Stricter rate limit for email sending
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50 // limit each IP to 50 email sends per hour
});

app.use(express.json());

// Add trust proxy for secure cookies
app.set('trust proxy', 1);

// CORS configuration
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://bobbiswas69.github.io'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin matches any of our allowed origins
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false
}));

// Create a persistent session store
const sessionStore = new session.MemoryStore();

// EXPRESS-SESSION with secure settings
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'none',
      domain: process.env.NODE_ENV === 'production' ? '.github.io' : undefined,
      path: '/'
    },
    name: 'sessionId',
    proxy: true,
    store: sessionStore,
    rolling: true,
    unset: 'destroy'
  })
);

// Initialize passport before routes
app.use(passport.initialize());
app.use(passport.session());

// Add logging middleware before routes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Session:', req.session);
  console.log('User:', req.user);
  console.log('Cookies:', req.cookies);
  console.log('Session Store:', sessionStore);
  next();
});

// PASSPORT CONFIG
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user);
  // Store the entire user object
  done(null, user);
});

passport.deserializeUser((user, done) => {
  console.log('Deserializing user:', user);
  // Return the entire user object
  done(null, user);
});

// Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === 'production' 
        ? 'https://email-sender-oauth.onrender.com/auth/google/callback'
        : 'http://localhost:3000/auth/google/callback',
      scope: ['profile', 'email', 'https://mail.google.com/'],
      accessType: 'offline',
      prompt: 'consent'
    },
    (accessToken, refreshToken, profile, done) => {
      console.log('Google OAuth callback received:', {
        email: profile.emails[0].value,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken
      });
      
      // Build user object
      const user = {
        email: profile.emails[0].value,
        accessToken,
        refreshToken
      };

      // Log the user object before passing to done
      console.log('Created user object:', user);
      done(null, user);
    }
  )
);

// ROUTES
app.get('/auth/google', (req, res, next) => {
  console.log('Starting Google OAuth flow');
  passport.authenticate('google')(req, res, next);
});

app.get(
  '/auth/google/callback',
  (req, res, next) => {
    console.log('Received Google OAuth callback');
    passport.authenticate('google', { 
      failureRedirect: '/auth/failure',
      failureMessage: true
    })(req, res, next);
  },
  (req, res) => {
    console.log('OAuth successful, redirecting to frontend');
    console.log('User after authentication:', req.user);
    // On success, redirect to your frontend
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://bobbiswas69.github.io/email-sender-oauth'
      : 'http://localhost:5500';
    res.redirect(frontendUrl);
  }
);

// Add error handling for auth failures
app.get('/auth/failure', (req, res) => {
  console.error('Auth failure:', req.session.messages);
  res.status(401).json({ 
    error: 'Authentication failed',
    message: req.session.messages?.pop() || 'Unknown error'
  });
});

// FIX LOGOUT
app.get('/logout', (req, res) => {
  if (req.session) {
    // First logout from passport
    req.logout((err) => {
      if (err) {
        console.error('Error logging out:', err);
      }
      // Then destroy the session
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        res.clearCookie('sessionId');
        res.clearCookie('connect.sid');
        
        // Set CORS headers
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        
        res.json({ success: true, message: 'Logged out successfully' });
      });
    });
  } else {
    res.json({ success: true, message: 'Already logged out' });
  }
});

// Check current user
app.get('/api/current-user', (req, res) => {
  if (!req.user) {
    return res.json({ loggedIn: false });
  }
  return res.json({ loggedIn: true, email: req.user.email });
});

// Input validation middleware
const validateEmailInput = [
  body('recipients').isArray().withMessage('Recipients must be an array'),
  body('recipients.*.name').notEmpty().withMessage('Recipient name is required'),
  body('recipients.*.email').isEmail().withMessage('Invalid recipient email'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('template').notEmpty().withMessage('Email template is required')
];

// Send emails endpoint
app.post('/send-emails', emailLimiter, validateEmailInput, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recipients, subject, template, userName, role, company, joblink, resume } = req.body;
    const user = req.user;

    if (!user || !user.accessToken) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log('Starting email send process for user:', user.email);
    console.log('Number of recipients:', recipients.length);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: user.email,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: user.refreshToken,
        accessToken: user.accessToken
      }
    });

    const results = [];
    for (const recipient of recipients) {
      try {
        console.log('Processing recipient:', recipient.email);
        
        // Replace template variables
        let personalizedTemplate = template
          .replace(/\{Name\}/g, recipient.name)
          .replace(/\{Role\}/g, role)
          .replace(/\{Company\}/g, company)
          .replace(/\{JobLink\}/g, joblink)
          .replace(/\{UserName\}/g, userName);

        // Prepare email options
        const mailOptions = {
          from: user.email,
          to: recipient.email,
          subject: subject
            .replace(/\{Role\}/g, role)
            .replace(/\{Company\}/g, company),
          text: personalizedTemplate,
          html: personalizedTemplate.replace(/\n/g, '<br>')
        };

        // Add resume attachment if provided
        if (resume) {
          mailOptions.attachments = [{
            filename: resume.fileName,
            content: resume.base64,
            encoding: 'base64'
          }];
        }

        console.log('Sending email to:', recipient.email);
        console.log('Mail options:', {
          from: user.email,
          to: recipient.email,
          subject: mailOptions.subject,
          hasAttachments: !!mailOptions.attachments
        });

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        results.push({
          email: recipient.email,
          status: 'success',
          messageId: info.messageId
        });
      } catch (error) {
        console.error('Error sending email to:', recipient.email, error);
        results.push({
          email: recipient.email,
          status: 'error',
          error: error.message
        });
      }
    }

    // Check if any emails were sent successfully
    const successCount = results.filter(r => r.status === 'success').length;
    if (successCount === 0) {
      return res.status(500).json({
        error: 'Failed to send any emails',
        details: results
      });
    }

    // Return results
    res.json({
      message: `Successfully sent ${successCount} out of ${recipients.length} emails`,
      results
    });
  } catch (error) {
    console.error('Detailed error sending emails:', error);
    res.status(500).json({ 
      error: 'Failed to send emails',
      details: error.message,
      stack: error.stack
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});

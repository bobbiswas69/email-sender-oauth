require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xssClean = require('xss-clean');
const xss = require('xss');
const hpp = require('hpp');
const { body, validationResult } = require('express-validator');

const app = express();

// Security middleware
app.use(helmet()); // Adds various HTTP headers for security
app.use(xssClean()); // Prevent XSS attacks
app.use(hpp()); // Prevent HTTP Parameter Pollution

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));

// EXPRESS-SESSION with secure settings
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-site requests
      domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined
    },
    name: 'sessionId',
    proxy: true // Trust the reverse proxy
  })
);

app.use(passport.initialize());
app.use(passport.session());

// PASSPORT CONFIG
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
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
      // Build user object
      const user = {
        email: profile.emails[0].value,
        accessToken,
        refreshToken
      };
      done(null, user);
    }
  )
);

// ROUTES
app.get('/auth/google', passport.authenticate('google'));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // On success, redirect to your frontend
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://bobbiswas69.github.io/email-sender-oauth'
      : 'http://localhost:5500';
    res.redirect(frontendUrl);
  }
);

app.get('/auth/failure', (req, res) => {
  res.send('Authentication failed.');
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
const validateEmailRequest = [
  body('userName').trim().notEmpty().withMessage('Name is required'),
  body('role').trim().notEmpty().withMessage('Role is required'),
  body('company').trim().notEmpty().withMessage('Company is required'),
  body('template').trim().notEmpty().withMessage('Template is required'),
  body('recipients').isArray().withMessage('Recipients must be an array'),
  body('recipients.*.name').trim().notEmpty().withMessage('Recipient name is required'),
  body('recipients.*.email').isEmail().withMessage('Invalid recipient email')
];

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  next();
});

// SEND EMAILS with validation
app.post('/send-emails', 
  emailLimiter, // Apply rate limiting
  validateEmailRequest, // Apply input validation
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { accessToken, refreshToken, email } = req.user;
    const { userName, role, company, joblink, subject, template, recipients, resume } = req.body;

    // Sanitize inputs
    const sanitizedTemplate = template;
    const sanitizedSubject = subject
      .replace(/\{Role\}/g, xss(role))
      .replace(/\{Company\}/g, xss(company))
      .replace(/\{UserName\}/g, xss(userName));

    // Create nodemailer transport with OAuth2
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: email,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        accessToken,
        refreshToken
      }
    });

    try {
      const results = [];
      for (const r of recipients) {
        const { name, email: recEmail } = r;

        // Replace placeholders in the template
        const personalizedBody = sanitizedTemplate
          .replace(/\{Name\}/g, xss(name))
          .replace(/\{Role\}/g, xss(role))
          .replace(/\{Company\}/g, xss(company))
          .replace(/\{JobLink\}/g, joblink ? xss(joblink) : '')
          .replace(/\{UserName\}/g, xss(userName));

        // Convert newlines to <br> for HTML
        const htmlBody = personalizedBody.replace(/\n/g, '<br>');

        const mailOptions = {
          from: email,
          to: recEmail,
          subject: sanitizedSubject,
          html: htmlBody
        };

        if (resume && resume.fileName && resume.base64) {
          // Validate file size (max 10MB)
          const fileSize = Buffer.from(resume.base64, 'base64').length;
          if (fileSize > 10 * 1024 * 1024) {
            throw new Error('Resume file size exceeds 10MB limit');
          }

          mailOptions.attachments = [
            {
              filename: resume.fileName,
              content: resume.base64,
              encoding: 'base64'
            }
          ];
        }

        console.log('Attempting to send email to:', recEmail);
        console.log('Mail options:', {
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          hasAttachments: !!mailOptions.attachments
        });

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        results.push({
          recipient: recEmail,
          status: 'success',
          messageId: result.messageId
        });
      }

      res.json({
        success: true,
        message: 'Emails sent successfully',
        results
      });
    } catch (err) {
      console.error('Detailed error sending emails:', {
        error: err.message,
        stack: err.stack,
        code: err.code,
        command: err.command
      });
      res.status(500).json({
        error: 'Failed to send emails',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
      });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});

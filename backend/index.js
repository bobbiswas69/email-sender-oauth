require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const { body, validationResult } = require('express-validator');
const { google } = require('googleapis');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
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
      domain: process.env.NODE_ENV === 'production' ? 'email-sender-oauth.onrender.com' : undefined,
      path: '/'
    },
    name: 'sessionId',
    proxy: true,
    store: sessionStore,
    rolling: true,
    unset: 'destroy'
  })
);

// Google OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NODE_ENV === 'production' 
    ? 'https://email-sender-oauth.onrender.com/auth/google/callback'
    : 'http://localhost:3000/auth/google/callback'
);

// Token refresh function
async function refreshAccessToken(refreshToken) {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { tokens } = await oauth2Client.refreshAccessToken();
    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

// Routes
app.get('/api/current-user', (req, res) => {
  console.log('Current user request received');
  console.log('Session:', req.session);
  console.log('User:', req.session.user);
  console.log('Cookies:', req.cookies);
  console.log('Session Store:', sessionStore);
  
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.session.user);
});

app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send'
    ],
    prompt: 'consent'
  });
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    console.log('Received Google OAuth callback');

    const { tokens } = await oauth2Client.getToken(code);
    console.log('Received tokens from Google');

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    console.log('Got user info:', data);

    // Store both access and refresh tokens in session
    req.session.user = {
      email: data.email,
      name: data.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      picture: data.picture
    };

    // Save session before redirect
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('OAuth successful, redirecting to frontend');
    res.redirect(process.env.NODE_ENV === 'production'
      ? 'https://bobbiswas69.github.io/email-sender-oauth/'
      : 'http://localhost:5500/'
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(process.env.NODE_ENV === 'production'
      ? 'https://bobbiswas69.github.io/email-sender-oauth/'
      : 'http://localhost:5500/'
    );
  }
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
  console.log(`Server is running on port ${PORT}`);
});

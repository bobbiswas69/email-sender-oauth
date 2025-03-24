// Configuration object
const config = {
  // API URL based on environment
  apiUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://email-sender-oauth.onrender.com',

  // Google OAuth configuration
  googleClientId: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'YOUR_LOCAL_GOOGLE_CLIENT_ID'
    : 'YOUR_PRODUCTION_GOOGLE_CLIENT_ID',

  // Email templates
  templates: [
    {
      name: 'Default Template',
      subject: 'Regarding {Role} at {Company}',
      body: `Dear {Name},

I hope this email finds you well. I am writing to express my strong interest in the {Role} position at {Company}.

I am confident that my skills and experience align well with the requirements for this role. I have attached my resume for your review.

I would welcome the opportunity to discuss how I can contribute to {Company}'s success.

Thank you for considering my application.

Best regards,
{UserName}`
    },
    {
      name: 'Follow-up Template',
      subject: 'Following up on {Role} Application at {Company}',
      body: `Dear {Name},

I hope this email finds you well. I wanted to follow up on my application for the {Role} position at {Company}.

I remain very interested in the opportunity and would welcome the chance to discuss how I can contribute to {Company}'s team.

I have attached my resume for your reference.

Thank you for your time and consideration.

Best regards,
{UserName}`
    }
  ]
};

// Export configuration
window.config = config;

// Determine environment based on hostname
const environment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'development' 
  : 'production';

const currentConfig = config[environment];

// Add error handling for API calls
const api = {
  async fetch(endpoint, options = {}) {
    try {
      console.log(`Making request to: ${currentConfig.apiUrl}${endpoint}`);
      const response = await fetch(`${currentConfig.apiUrl}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow',
        referrerPolicy: 'strict-origin-when-cross-origin',
        keepalive: true
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
};

// Log current configuration (development only)
if (environment === 'development') {
  console.log('Current config:', currentConfig);
}

export { currentConfig as default, api };
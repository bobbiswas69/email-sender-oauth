const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    googleClientId: 'your_development_client_id'
  },
  production: {
    apiUrl: 'https://email-sender-oauth.onrender.com',
    googleClientId: 'your_production_client_id', // We'll get this from Google Cloud Console
    baseUrl: 'https://bobbiswas69.github.io/email-sender-oauth'
  }
};

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
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
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
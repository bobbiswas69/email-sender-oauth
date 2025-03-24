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

const environment = window.location.hostname === 'localhost' ? 'development' : 'production';
const currentConfig = config[environment];

// Add error handling for API calls
const api = {
  async fetch(endpoint, options = {}) {
    try {
      const response = await fetch(`${currentConfig.apiUrl}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
};

export { currentConfig as default, api };
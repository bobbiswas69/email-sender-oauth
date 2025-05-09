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
const environment = window.location.hostname === 'localhost' ? 'development' : 'production';

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

// Helper function to make API calls with proper credentials
export async function apiCall(endpoint, options = {}) {
  const baseUrl = config[environment].apiUrl;
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  try {
    console.log(`Making API call to ${baseUrl}${endpoint}`);
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...defaultOptions,
      ...options
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      });
      throw new Error(`API call failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`API call successful: ${endpoint}`, data);
    return data;
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    throw error;
  }
}
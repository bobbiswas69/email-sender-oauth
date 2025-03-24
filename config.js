const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    googleClientId: 'your_development_client_id'
  },
  production: {
    apiUrl: 'http://localhost:3000', // We'll update this after backend deployment
    googleClientId: 'your_production_client_id' // We'll get this from Google Cloud Console one more change
  }
};

const environment = window.location.hostname === 'localhost' ? 'development' : 'production';
export default config[environment];
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    googleClientId: 'your_development_client_id'
  },
  production: {
    apiUrl: 'https://oneclick-mailer-backend.onrender.com', // We'll update this with your actual Render URL
    googleClientId: 'your_production_client_id' // We'll get this from Google Cloud Console
  }
};

const environment = window.location.hostname === 'localhost' ? 'development' : 'production';
export default config[environment];
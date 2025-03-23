const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    googleClientId: 'your_development_client_id'
  },
  production: {
    apiUrl: 'https://your-render-backend-url.onrender.com',
    googleClientId: 'your_production_client_id'
  }
};

const environment = window.location.hostname === 'localhost' ? 'development' : 'production';
export default config[environment]; 
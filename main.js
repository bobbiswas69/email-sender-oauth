import config, { api } from './config.js';

let resume = null;

// DOM Elements
const authStatus = document.getElementById('authStatus');
const actions = document.getElementById('actions');
const sendButton = document.getElementById('sendButton');
const emailTemplate = document.getElementById('emailTemplate');
const templatePreview = document.getElementById('templatePreview');
const templateSelect = document.getElementById('templateSelect');

// State management
let state = {
  darkMode: localStorage.getItem('darkMode') === 'true',
  templates: JSON.parse(localStorage.getItem('templates') || '[]')
};

// Theme toggle
const themeToggle = document.createElement('button');
themeToggle.className = 'theme-toggle';
themeToggle.innerHTML = state.darkMode ? '☀️' : '🌙';
themeToggle.onclick = () => {
  state.darkMode = !state.darkMode;
  localStorage.setItem('darkMode', state.darkMode);
  document.body.classList.toggle('dark-mode');
  themeToggle.innerHTML = state.darkMode ? '☀️' : '🌙';
};
document.body.appendChild(themeToggle);

// Initialize dark mode
if (state.darkMode) {
  document.body.classList.add('dark-mode');
}

// Notification system
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }, 100);
}

// Loading state
function setLoading(isLoading) {
  if (sendButton) {
    sendButton.disabled = isLoading;
    sendButton.innerHTML = isLoading ? 
      '<span class="loading-spinner"></span> Sending...' : 
      'Send Emails';
  }
}

// Template preview
function updateTemplatePreview() {
  if (!emailTemplate || !templatePreview) return;
  
  const template = emailTemplate.value;
  const preview = template
    .replace(/\{Name\}/g, 'John Doe')
    .replace(/\{Role\}/g, 'Software Engineer')
    .replace(/\{Company\}/g, 'Tech Corp')
    .replace(/\{JobLink\}/g, 'https://example.com/job')
    .replace(/\{UserName\}/g, 'Your Name');
  
  templatePreview.innerHTML = preview.replace(/\n/g, '<br>');
}

// Character counter
function updateCharCount() {
  if (!emailTemplate) return;
  const count = emailTemplate.value.length;
  const counter = document.getElementById('charCount');
  if (counter) {
    counter.textContent = `${count}/5000 characters`;
  }
}

// Template management
function saveTemplate() {
  if (!emailTemplate) return;
  const name = prompt('Enter template name:');
  if (!name) return;
  
  state.templates.push({
    name,
    content: emailTemplate.value
  });
  localStorage.setItem('templates', JSON.stringify(state.templates));
  updateTemplateSelect();
  showNotification('Template saved successfully', 'success');
}

function updateTemplateSelect() {
  if (!templateSelect) return;
  
  templateSelect.innerHTML = '<option value="">Select a template</option>';
  state.templates.forEach((template, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = template.name;
    templateSelect.appendChild(option);
  });
}

// Initialize template select
if (templateSelect) {
  updateTemplateSelect();
  templateSelect.addEventListener('change', (e) => {
    if (emailTemplate && e.target.value !== '') {
      emailTemplate.value = state.templates[e.target.value].content;
      updateTemplatePreview();
      updateCharCount();
    }
  });
}

// Event listeners
if (emailTemplate) {
  emailTemplate.addEventListener('input', () => {
    updateTemplatePreview();
    updateCharCount();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();

  // Initialize template preview and character counter
  const charCounter = document.createElement('div');
  charCounter.id = 'charCount';
  charCounter.className = 'char-counter';
  const templateSection = document.getElementById('template-section');
  if (templateSection) {
    templateSection.style.position = 'relative';
    templateSection.appendChild(charCounter);
  }

  // Load templates dropdown
  const templateSelect = document.createElement('select');
  templateSelect.id = 'templateSelect';
  templateSelect.className = 'template-select';
  templateSelect.innerHTML = '<option value="">Select a template</option>';
  if (templateSection) {
    templateSection.insertBefore(templateSelect, document.getElementById('emailTemplate'));
  }

  // Save template button
  const saveTemplateBtn = document.createElement('button');
  saveTemplateBtn.textContent = 'Save Template';
  saveTemplateBtn.onclick = saveTemplate;
  if (templateSection) {
    templateSection.insertBefore(saveTemplateBtn, document.getElementById('emailTemplate'));
  }

  // Add event listeners only if elements exist
  const addRecipientBtn = document.getElementById('addRecipientBtn');
  const resumeFileInput = document.getElementById('resumeFileInput');
  const sendBtn = document.getElementById('sendBtn');

  if (addRecipientBtn) addRecipientBtn.addEventListener('click', addRecipient);
  if (resumeFileInput) resumeFileInput.addEventListener('change', handleResumeUpload);
  if (sendBtn) sendBtn.addEventListener('click', sendEmails);

  // Initialize
  loadTemplates();
  updateCharCount();
  updateTemplatePreview();
});

// Smooth scroll
function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth' });
}

// Make scrollToSection globally available
window.scrollToSection = function(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth' });
};

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const response = await fetch(`${config.apiUrl}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API call failed');
  }

  return response.json();
}

// Check authentication status on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkAuthStatus();
  } catch (error) {
    console.error('Error checking auth status:', error);
    showLoginButton();
  }
});

// Check authentication status
async function checkAuthStatus() {
  try {
    const response = await apiCall('/api/current-user');
    if (response.loggedIn) {
      showUserInfo(response.email);
    } else {
      showLoginButton();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginButton();
  }
}

// Show login button
function showLoginButton() {
  document.getElementById('loginButton').style.display = 'block';
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('emailForm').style.display = 'none';
}

// Show user info
function showUserInfo(email) {
  document.getElementById('loginButton').style.display = 'none';
  document.getElementById('userInfo').style.display = 'block';
  document.getElementById('emailForm').style.display = 'block';
  document.getElementById('userEmail').textContent = email;
}

// Global logout function
async function logout() {
  try {
    await apiCall('/logout');
    showLoginButton();
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

// Handle form submission
document.getElementById('emailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    userName: document.getElementById('userName').value,
    role: document.getElementById('role').value,
    company: document.getElementById('company').value,
    joblink: document.getElementById('joblink').value,
    subject: document.getElementById('subject').value,
    template: document.getElementById('template').value,
    recipients: []
  };

  // Get recipients
  const recipientRows = document.querySelectorAll('.recipient-row');
  recipientRows.forEach(row => {
    formData.recipients.push({
      name: row.querySelector('.recipient-name').value,
      email: row.querySelector('.recipient-email').value
    });
  });

  // Handle resume file
  const resumeFile = document.getElementById('resume').files[0];
  if (resumeFile) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      formData.resume = {
        fileName: resumeFile.name,
        base64: e.target.result.split(',')[1]
      };
      await sendEmails(formData);
    };
    reader.readAsDataURL(resumeFile);
  } else {
    await sendEmails(formData);
  }
});

// Send emails
async function sendEmails(formData) {
  try {
    const button = document.getElementById('sendButton');
    button.disabled = true;
    button.textContent = 'Sending...';

    const response = await apiCall('/send-emails', {
      method: 'POST',
      body: JSON.stringify(formData)
    });

    alert('Emails sent successfully!');
    document.getElementById('emailForm').reset();
  } catch (error) {
    console.error('Error sending emails:', error);
    alert('Failed to send emails: ' + error.message);
  } finally {
    const button = document.getElementById('sendButton');
    button.disabled = false;
    button.textContent = 'Send Emails';
  }
}

// Add recipient row
document.getElementById('addRecipient').addEventListener('click', () => {
  const container = document.getElementById('recipientsContainer');
  const row = document.createElement('div');
  row.className = 'recipient-row';
  row.innerHTML = `
    <input type="text" class="recipient-name" placeholder="Recipient Name" required>
    <input type="email" class="recipient-email" placeholder="Recipient Email" required>
    <button type="button" class="remove-recipient">Remove</button>
  `;
  container.appendChild(row);
});

// Remove recipient row
document.getElementById('recipientsContainer').addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-recipient')) {
    e.target.parentElement.remove();
  }
});

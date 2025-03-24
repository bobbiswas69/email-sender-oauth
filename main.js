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

async function checkAuthStatus() {
  try {
    const data = await api.fetch('/api/current-user');
    const authStatus = document.getElementById('authStatus');
    const authActions = document.getElementById('authActions');

    if (data.loggedIn) {
      authStatus.textContent = `Logged in as: ${data.email}`;
      authActions.innerHTML = `
        <button onclick="logout()" style="margin:auto;">Logout</button>
      `;
    } else {
      authStatus.textContent = 'Not logged in. Please sign in.';
      authActions.innerHTML = `
        <button onclick="signIn()" style="display:flex;align-items:center;gap:5px;margin:auto;">
          <img 
            src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
            alt="G" 
            style="width:18px;height:18px;"
          >
          Sign in
        </button>
      `;
    }
  } catch (err) {
    console.error('Auth status check error:', err);
    const authStatus = document.getElementById('authStatus');
    if (authStatus) {
      authStatus.textContent = 'Error checking login status. Please try again.';
    }
  }
}

// Make signIn and logout globally available
window.signIn = function() {
  window.location.href = `${config.apiUrl}/auth/google`;
};

window.logout = async function() {
  try {
    await api.fetch('/logout');
    window.location.reload();
  } catch (err) {
    console.error('Logout error:', err);
    showNotification('Error logging out. Please try again.', 'error');
  }
};

function addRecipient() {
  const list = document.getElementById('recipient-list');
  const newBlock = document.createElement('div');
  newBlock.classList.add('recipient-block');
  newBlock.innerHTML = `
    <input type="text" name="name" placeholder="Recipient Name" required>
    <input type="email" name="email" placeholder="Recipient Email" required>
    <button class="remove-recipient" onclick="removeRecipient(this)">x</button>
  `;
  list.appendChild(newBlock);
}

function removeRecipient(btn) {
  const block = btn.parentElement;
  block.remove();
}

function handleResumeUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type !== 'application/pdf') {
    alert('Only PDF files are allowed.');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const base64Str = ev.target.result.split(',')[1];
    resume = {
      fileName: file.name,
      base64: base64Str
    };
    document.getElementById('uploadedResumeName').textContent = `Selected: ${file.name}`;
  };
  reader.readAsDataURL(file);
}

function loadTemplates() {
  const templateSelect = document.querySelector('.template-select');
  templateSelect.innerHTML = '<option value="">Select a template</option>';
  state.templates.forEach((template, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = template.name;
    templateSelect.appendChild(option);
  });
}

async function sendEmails() {
  setLoading(true);
  
  try {
    // Check if user is logged in first
    const authStatus = document.getElementById('authStatus').textContent;
    if (!authStatus.includes('Logged in as:')) {
      showNotification('Please sign in first', 'error');
      setLoading(false);
      return;
    }

    const formData = {
      userName: document.getElementById('userNameInput').value,
      role: document.getElementById('role').value,
      company: document.getElementById('company').value,
      joblink: document.getElementById('joblink').value,
      subject: document.getElementById('subjectInput').value,
      template: document.getElementById('emailTemplate').value,
      recipients: Array.from(document.querySelectorAll('.recipient-block')).map(block => ({
        name: block.querySelector('input[name="name"]').value,
        email: block.querySelector('input[name="email"]').value
      }))
    };

    // Validate required fields
    if (!formData.userName || !formData.role || !formData.company || !formData.template) {
      showNotification('Please fill in all required fields', 'error');
      setLoading(false);
      return;
    }

    if (formData.recipients.length === 0) {
      showNotification('Please add at least one recipient', 'error');
      setLoading(false);
      return;
    }

    // If subject is empty or unchanged, use default
    if (!formData.subject || formData.subject === 'Regarding {Role} at {Company}') {
      formData.subject = `Regarding ${formData.role} at ${formData.company}`;
    }

    console.log('Sending form data:', {
      ...formData,
      template: formData.template.substring(0, 100) + '...' // Log only first 100 chars of template
    });

    const resumeFile = document.getElementById('resumeFileInput').files[0];
    if (resumeFile) {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.readAsDataURL(resumeFile);
      });
      
      formData.resume = {
        fileName: resumeFile.name,
        base64
      };
    }

    const response = await fetch(`${config.apiUrl}/send-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    console.log('Server response:', data);
    
    if (response.ok) {
      showNotification('Emails sent successfully!', 'success');
      // Clear form
      document.getElementById('resumeFileInput').value = '';
      document.getElementById('uploadedResumeName').textContent = '';
    } else {
      throw new Error(data.message || 'Failed to send emails');
    }
  } catch (error) {
    console.error('Error sending emails:', error);
    showNotification(error.message, 'error');
  } finally {
    setLoading(false);
  }
}

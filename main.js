import config from './config.js';

let resume = null;

// State management
let state = {
  isDarkMode: localStorage.getItem('darkMode') === 'true',
  templates: JSON.parse(localStorage.getItem('templates') || '[]'),
  currentTemplate: null
};

document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();

  document.getElementById('addRecipientBtn').addEventListener('click', addRecipient);
  document.getElementById('resumeFileInput').addEventListener('change', handleResumeUpload);
  document.getElementById('sendBtn').addEventListener('click', sendEmails);

  // Initialize template preview and character counter
  const charCounter = document.createElement('div');
  charCounter.className = 'char-counter';
  document.getElementById('template-section').style.position = 'relative';
  document.getElementById('template-section').appendChild(charCounter);

  // Load templates dropdown
  const templateSelect = document.createElement('select');
  templateSelect.className = 'template-select';
  templateSelect.innerHTML = '<option value="">Select a template</option>';
  document.getElementById('template-section').insertBefore(templateSelect, document.getElementById('emailTemplate'));

  // Save template button
  const saveTemplateBtn = document.createElement('button');
  saveTemplateBtn.textContent = 'Save Template';
  saveTemplateBtn.onclick = saveTemplate;
  document.getElementById('template-section').insertBefore(saveTemplateBtn, document.getElementById('emailTemplate'));

  // Initialize
  loadTemplates();
  updateCharCount();
  updateTemplatePreview();

  // Add event listeners
  const emailTemplate = document.getElementById('emailTemplate');
  emailTemplate.addEventListener('input', () => {
    updateTemplatePreview();
    updateCharCount();
  });
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

function checkAuthStatus() {
  fetch('http://localhost:3000/api/current-user', { credentials: 'include' })
    .then(resp => resp.json())
    .then(data => {
      const authStatus = document.getElementById('authStatus');
      const authActions = document.getElementById('authActions');

      if (data.loggedIn) {
        authStatus.textContent = `Logged in as: ${data.email}`;
        authActions.innerHTML = `
          <button onclick="logout()" style="margin:auto;">Logout</button>
        `;
      } else {
        authStatus.textContent = 'Not logged in. Please sign in.';
        // use the new g icon link
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
    })
    .catch(err => {
      console.error(err);
      document.getElementById('authStatus').textContent = 'Error checking login status';
    });
}

// Make signIn and logout globally available
window.signIn = function() {
  window.location.href = 'http://localhost:3000/auth/google';
};

window.logout = function() {
  fetch('http://localhost:3000/logout', { credentials: 'include' })
    .then(() => {
      window.location.reload();
    })
    .catch(err => console.error(err));
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

// Notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Loading state
function setLoading(isLoading) {
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = isLoading;
  if (isLoading) {
    sendBtn.innerHTML = '<span class="loading-spinner"></span>Sending...';
  } else {
    sendBtn.textContent = 'Send Emails';
  }
}

// Theme toggle
function toggleTheme() {
  state.isDarkMode = !state.isDarkMode;
  localStorage.setItem('darkMode', state.isDarkMode);
  updateTheme();
}

function updateTheme() {
  document.body.classList.toggle('dark-mode', state.isDarkMode);
  const themeToggle = document.querySelector('.theme-toggle');
  themeToggle.innerHTML = state.isDarkMode ? '☀️' : '🌙';
}

// Template preview
function updateTemplatePreview() {
  const emailTemplate = document.getElementById('emailTemplate');
  const preview = emailTemplate.value
    .replace(/\{Name\}/g, 'John Doe')
    .replace(/\{Role\}/g, 'Software Engineer')
    .replace(/\{Company\}/g, 'Example Corp')
    .replace(/\{JobLink\}/g, 'https://example.com/job')
    .replace(/\{UserName\}/g, 'Your Name');
  
  const templatePreview = document.querySelector('.template-preview');
  templatePreview.innerHTML = preview;
}

// Character counter
function updateCharCount() {
  const emailTemplate = document.getElementById('emailTemplate');
  const count = emailTemplate.value.length;
  const charCounter = document.querySelector('.char-counter');
  charCounter.textContent = `${count} characters`;
}

// Template management
function saveTemplate() {
  // Check if user is logged in
  if (!document.getElementById('authStatus').textContent.includes('Logged in as:')) {
    showNotification('Please sign in to save templates', 'error');
    return;
  }

  const template = {
    name: prompt('Enter template name:'),
    content: document.getElementById('emailTemplate').value
  };
  
  if (template.name) {
    state.templates.push(template);
    localStorage.setItem('templates', JSON.stringify(state.templates));
    showNotification('Template saved successfully', 'success');
  }
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

templateSelect.addEventListener('change', (e) => {
  if (e.target.value !== '') {
    document.getElementById('emailTemplate').value = state.templates[e.target.value].content;
    updateTemplatePreview();
    updateCharCount();
  }
});

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

const form = document.getElementById('setup-form');
const formView = document.getElementById('form-view');
const progressView = document.getElementById('progress-view');
const errorMsg = document.getElementById('error-msg');
const submitBtn = document.getElementById('submit-btn');

const nameInput = document.getElementById('name');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

function setFieldError(input, message) {
  clearFieldError(input);
  input.classList.add('invalid');
  const el = document.createElement('p');
  el.className = 'field-error';
  el.textContent = message;
  input.insertAdjacentElement('afterend', el);
  // Hide adjacent hint when showing an error
  const hint = el.nextElementSibling;
  if (hint && hint.classList.contains('field-hint')) hint.classList.add('hidden');
}

function clearFieldError(input) {
  input.classList.remove('invalid');
  const next = input.nextElementSibling;
  if (next && next.classList.contains('field-error')) {
    // Restore adjacent hint
    const hint = next.nextElementSibling;
    if (hint && hint.classList.contains('field-hint')) hint.classList.remove('hidden');
    next.remove();
  }
}

function validateForm() {
  let valid = true;

  clearFieldError(nameInput);
  clearFieldError(usernameInput);
  clearFieldError(passwordInput);

  if (!nameInput.value.trim()) {
    setFieldError(nameInput, 'Name is required.');
    valid = false;
  }

  if (!usernameInput.value.trim()) {
    setFieldError(usernameInput, 'Username is required.');
    valid = false;
  }

  const pw = passwordInput.value;
  if (!pw) {
    setFieldError(passwordInput, 'Password is required.');
    valid = false;
  } else if (pw.length < 10) {
    setFieldError(passwordInput, 'Password must be at least 10 characters.');
    valid = false;
  }

  return valid;
}

// Clear errors on input
[nameInput, usernameInput, passwordInput].forEach((input) => {
  input.addEventListener('input', () => clearFieldError(input));
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const name = nameInput.value.trim();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  submitBtn.disabled = true;
  formView.classList.add('hidden');
  progressView.classList.remove('hidden');

  await window.whoami.startSetup({ name, username, password });
});

// Listen for progress updates
window.whoami.onProgress(({ step, status }) => {
  const li = document.querySelector(`[data-step="${step}"]`);
  if (!li) return;

  li.classList.remove('running', 'done', 'error');
  li.classList.add(status === 'running' ? 'running' : status === 'done' ? 'done' : 'error');
});

window.whoami.onSetupComplete(() => {
  const heading = progressView.querySelector('h1');
  if (heading) heading.textContent = 'All set!';
});

window.whoami.onSetupError((message) => {
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
});

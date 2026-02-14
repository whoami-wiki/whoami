const form = document.getElementById('setup-form');
const formView = document.getElementById('form-view');
const progressView = document.getElementById('progress-view');
const errorMsg = document.getElementById('error-msg');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!name || !username || !password) return;

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

const btnBack = document.getElementById('btn-back');
const btnForward = document.getElementById('btn-forward');
const btnSettings = document.getElementById('btn-settings');
const pageTitle = document.getElementById('page-title');

btnBack.addEventListener('click', () => {
  window.navbar.goBack();
});

btnForward.addEventListener('click', () => {
  window.navbar.goForward();
});

btnSettings.addEventListener('click', () => {
  const rect = btnSettings.getBoundingClientRect();
  window.navbar.openSettings({ x: Math.round(rect.left), y: Math.round(rect.bottom) });
});

window.navbar.onNavigationState((state) => {
  btnBack.disabled = !state.canGoBack;
  btnForward.disabled = !state.canGoForward;
});

window.navbar.onTitleUpdate((title) => {
  pageTitle.textContent = title || 'Whoami Wiki';
});

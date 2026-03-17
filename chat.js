const chatWindow = document.getElementById('chatWindow');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const personaSelect = document.getElementById('personaSelect');
const userNameInput = document.getElementById('userName');

function getDisplayName() {
  const name = userNameInput?.value?.trim();
  return name || 'You';
}

function appendMessage(text, who, isError) {
  if (!chatWindow) return;
  const div = document.createElement('div');
  div.className = 'chat-message ' + (who === 'user' ? 'user' : 'bot');
  if (isError) div.classList.add('error');

  const label = document.createElement('small');
  label.textContent = who === 'user' ? getDisplayName() : 'Bot';

  const body = document.createElement('div');
  body.textContent = text;

  div.appendChild(label);
  div.appendChild(body);
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendLoading() {
  if (!chatWindow) return;
  const div = document.createElement('div');
  div.className = 'chat-message bot loading';
  div.id = 'chatLoading';
  const label = document.createElement('small');
  label.textContent = 'Bot';
  const body = document.createElement('div');
  body.textContent = '…';
  div.appendChild(label);
  div.appendChild(body);
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeLoading() {
  document.getElementById('chatLoading')?.remove();
}

async function handleSend() {
  if (!chatInput) return;
  const value = chatInput.value.trim();
  if (!value) return;

  const persona = personaSelect ? personaSelect.value : '6';
  const userName = userNameInput ? String(userNameInput.value || '').trim() : '';
  appendMessage(value, 'user');
  chatInput.value = '';
  chatSend.disabled = true;
  chatInput.disabled = true;
  appendLoading();

  const payload = { message: value, persona, userName };
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));

    removeLoading();
    if (!res.ok) {
      appendMessage(data.error || 'Something went wrong.', 'bot', true);
      return;
    }
    appendMessage(data.reply || "I didn't get a reply.", 'bot');
  } catch (e) {
    removeLoading();
    appendMessage('Network error. Is the server running? Run: npm start', 'bot', true);
  } finally {
    chatSend.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
}

if (chatSend && chatInput) {
  chatSend.addEventListener('click', handleSend);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

// Theme switch (light/dark)
const themeSwitch = document.getElementById('themeSwitch');
const THEME_KEY = 'chatTheme';

function applyTheme(light) {
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
  if (themeSwitch) themeSwitch.checked = light;
}

if (themeSwitch) {
  const saved = localStorage.getItem(THEME_KEY);
  const preferLight = saved === 'light';
  applyTheme(preferLight);

  themeSwitch.addEventListener('change', () => {
    const light = themeSwitch.checked;
    localStorage.setItem(THEME_KEY, light ? 'light' : 'dark');
    applyTheme(light);
  });
}

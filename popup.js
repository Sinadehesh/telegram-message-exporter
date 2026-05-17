let extractedMessages = [];
let currentFormat = 'txt';

document.querySelectorAll('.format-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFormat = btn.dataset.format;
    if (extractedMessages.length > 0) updatePreview();
  });
});

function setStatus(text, type = 'idle') {
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  dot.className = 'dot' + (type === 'active' ? ' active' : type === 'error' ? ' error' : '');
  statusText.textContent = text;
}

function formatMessages(messages, format) {
  if (format === 'json') return JSON.stringify(messages, null, 2);
  if (format === 'csv') {
    const header = 'Number,Sender,Timestamp,Message\n';
    const rows = messages.map(m =>
      `${m.number},"${(m.sender||'').replace(/"/g,'""')}","${(m.timestamp||'').replace(/"/g,'""')}","${(m.text||'').replace(/"/g,'""').replace(/\n/g,' ')}"`
    ).join('\n');
    return header + rows;
  }
  if (format === 'md') {
    return messages.map(m => {
      const header = m.sender && m.sender !== 'Unknown'
        ? `**[${m.number}]** **${m.sender}**${m.timestamp ? ` *(${m.timestamp})*` : ''}`
        : `**[${m.number}]**${m.timestamp ? ` *(${m.timestamp})*` : ''}`;
      return `${header}\n${m.text}\n`;
    }).join('\n---\n\n');
  }
  return messages.map(m => {
    const meta = m.sender && m.sender !== 'Unknown'
      ? `[${m.number}] ${m.sender}${m.timestamp ? ' | ' + m.timestamp : ''}`
      : `[${m.number}]${m.timestamp ? ' | ' + m.timestamp : ''}`;
    return `${meta}\n${m.text}`;
  }).join('\n\n' + '\u2500'.repeat(40) + '\n\n');
}

function updatePreview() {
  const formatted = formatMessages(extractedMessages, currentFormat);
  const previewBox = document.getElementById('previewBox');
  const preview = formatted.substring(0, 1200) + (formatted.length > 1200 ? '\n\n... (truncated in preview)' : '');
  previewBox.textContent = preview;
  previewBox.classList.add('visible');
}

function getExtension(format) {
  return { txt: 'txt', json: 'json', csv: 'csv', md: 'md' }[format] || 'txt';
}

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).catch(() => {});
}

// Quick extract (visible only)
document.getElementById('btnExtract').addEventListener('click', async () => {
  const btn = document.getElementById('btnExtract');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Extracting...';
  setStatus('Scanning visible messages...', 'idle');
  try {
    const tab = await getTab();
    if (!tab.url || !tab.url.includes('web.telegram.org')) {
      setStatus('Please open web.telegram.org first', 'error');
      btn.disabled = false; btn.innerHTML = 'Extract Visible';
      return;
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractMessages' });
    if (!response || !response.messages || response.messages.length === 0) {
      setStatus('No messages found. Make sure a chat is open.', 'error');
    } else {
      extractedMessages = response.messages;
      const count = extractedMessages.length;
      setStatus(`Got ${count} message${count > 1 ? 's' : ''} (visible only)`, 'active');
      document.getElementById('footerNote').textContent = `Messages #1 – #${count}`;
      document.getElementById('btnCopy').disabled = false;
      document.getElementById('btnDownload').disabled = false;
      updatePreview();
    }
  } catch (err) {
    setStatus('Error: ' + (err.message || 'Could not connect'), 'error');
  }
  btn.disabled = false;
  btn.innerHTML = 'Extract Visible';
});

// Full extract (auto-scroll through entire chat)
document.getElementById('btnExtractAll').addEventListener('click', async () => {
  const btn = document.getElementById('btnExtractAll');
  btn.disabled = true;
  document.getElementById('btnExtract').disabled = true;
  setStatus('Auto-scrolling... collecting messages', 'idle');

  // Listen for progress updates
  const progressListener = (msg) => {
    if (msg.action === 'progress') {
      setStatus(`Collecting... ${msg.count} messages so far`, 'idle');
    }
  };
  chrome.runtime.onMessage.addListener(progressListener);

  try {
    const tab = await getTab();
    if (!tab.url || !tab.url.includes('web.telegram.org')) {
      setStatus('Please open web.telegram.org first', 'error');
      btn.disabled = false; document.getElementById('btnExtract').disabled = false;
      chrome.runtime.onMessage.removeListener(progressListener);
      return;
    }
    await ensureContentScript(tab.id);

    btn.innerHTML = '<div class="spinner"></div> Scrolling...';

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractAll' });
    chrome.runtime.onMessage.removeListener(progressListener);

    if (!response || !response.messages || response.messages.length === 0) {
      setStatus('No messages found. Make sure a chat is open.', 'error');
    } else {
      extractedMessages = response.messages;
      const count = extractedMessages.length;
      setStatus(`✓ Extracted ${count} messages`, 'active');
      document.getElementById('footerNote').textContent = `Messages #1 – #${count}`;
      document.getElementById('btnCopy').disabled = false;
      document.getElementById('btnDownload').disabled = false;
      updatePreview();
    }
  } catch (err) {
    chrome.runtime.onMessage.removeListener(progressListener);
    setStatus('Error: ' + (err.message || 'Could not connect'), 'error');
  }

  btn.disabled = false;
  btn.innerHTML = 'Extract ALL (auto-scroll)';
  document.getElementById('btnExtract').disabled = false;
});

document.getElementById('btnCopy').addEventListener('click', async () => {
  const formatted = formatMessages(extractedMessages, currentFormat);
  try {
    await navigator.clipboard.writeText(formatted);
    const btn = document.getElementById('btnCopy');
    btn.innerHTML = '\u2713 Copied!';
    setTimeout(() => { btn.innerHTML = 'Copy to Clipboard'; }, 1800);
  } catch (e) { setStatus('Clipboard access denied', 'error'); }
});

document.getElementById('btnDownload').addEventListener('click', () => {
  const formatted = formatMessages(extractedMessages, currentFormat);
  const ext = getExtension(currentFormat);
  const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `telegram-messages-${timestamp}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
});

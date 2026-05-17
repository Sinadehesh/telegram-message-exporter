// Telegram Message Exporter - Content Script

function extractMessages() {
  const results = [];

  // Telegram Web uses different selectors depending on the version (K vs A)
  // We try multiple known selectors for robustness
  const messageSelectors = [
    '.message',
    '.Message',
    '[class*="message_"]',
    '.bubbles-inner .bubble',
    '.messages-container .bubble',
    '[data-mid]',
  ];

  let messageNodes = [];
  for (const sel of messageSelectors) {
    const found = document.querySelectorAll(sel);
    if (found.length > 0) {
      messageNodes = Array.from(found);
      break;
    }
  }

  // Fallback: grab anything with message text class
  if (messageNodes.length === 0) {
    messageNodes = Array.from(document.querySelectorAll('[class*="message"]'));
  }

  let counter = 1;

  messageNodes.forEach((node) => {
    // Skip service messages (date separators, join notices, etc.)
    if (
      node.classList.contains('service') ||
      node.classList.contains('Service') ||
      node.getAttribute('data-is-service') === 'true'
    ) return;

    // Try to get sender name
    const senderSelectors = [
      '.peer-title',
      '.message-author',
      '.name',
      '[class*="author"]',
      '[class*="sender"]',
    ];
    let sender = '';
    for (const s of senderSelectors) {
      const el = node.querySelector(s);
      if (el && el.innerText.trim()) {
        sender = el.innerText.trim();
        break;
      }
    }

    // Try to get message text
    const textSelectors = [
      '.message',
      '.text-content',
      '.message-text',
      '[class*="messageText"]',
      '[class*="message-text"]',
      'span.translatable-message',
    ];
    let text = '';
    for (const s of textSelectors) {
      const el = node.querySelector(s);
      if (el && el.innerText.trim()) {
        text = el.innerText.trim();
        break;
      }
    }

    if (!text && node.innerText) {
      text = node.innerText.trim();
    }

    // Try to get timestamp
    const timeSelectors = ['time', '.time', '[class*="time"]', '.message-time'];
    let timestamp = '';
    for (const s of timeSelectors) {
      const el = node.querySelector(s);
      if (el) {
        timestamp = el.getAttribute('datetime') || el.innerText.trim() || '';
        break;
      }
    }

    if (!text || text.length < 1) return;

    results.push({
      number: counter++,
      sender: sender || 'Unknown',
      text,
      timestamp,
    });
  });

  return results;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractMessages') {
    const messages = extractMessages();
    sendResponse({ messages });
  }
});

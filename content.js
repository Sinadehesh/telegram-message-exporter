// Telegram Message Exporter - Content Script
// Targets the message area, not the chat list sidebar

let allMessages = new Map();
let isExtracting = false;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function findMessageScrollContainer() {
  // Telegram Web A: the message area is .bubbles-inner's parent — .bubbles
  // It is always INSIDE .chat or .chat-container, NOT in .chatlist or .sidebar

  // Most reliable: find the scrollable div that CONTAINS .bubble elements
  const bubbles = document.querySelector('.bubble:not(.service)');
  if (bubbles) {
    // Walk up the DOM to find its scrollable ancestor
    let el = bubbles.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return el;
      }
      el = el.parentElement;
    }
  }

  // Fallback: known Telegram Web A class names for the message viewport
  const candidates = [
    '.bubbles-inner',
    '.chat .bubbles',
    '.chat-input ~ * .bubbles',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && el.scrollHeight > el.clientHeight + 50) return el;
  }

  return null;
}

function scrapeVisible() {
  const nodes = [
    ...document.querySelectorAll('.bubble:not(.service):not(.is-date)'),
  ];

  nodes.forEach(node => {
    // Skip date separators and service messages
    if (
      node.classList.contains('service') ||
      node.classList.contains('is-date') ||
      node.classList.contains('bubble-service')
    ) return;

    // Sender
    let sender = '';
    const senderEl = node.querySelector('.peer-title, .name, .message-author');
    if (senderEl) sender = senderEl.innerText.trim();

    // Text
    let text = '';
    const textEls = [
      node.querySelector('.message'),
      node.querySelector('.text-content'),
      node.querySelector('[class*="message-text"]'),
      node.querySelector('span.translatable-message'),
    ];
    for (const el of textEls) {
      if (el && el.innerText.trim()) { text = el.innerText.trim(); break; }
    }
    if (!text) text = node.innerText.trim();
    if (!text || text.length < 1) return;

    // Timestamp
    let timestamp = '';
    const timeEl = node.querySelector('time, .time, [class*="time"]');
    if (timeEl) timestamp = timeEl.getAttribute('datetime') || timeEl.innerText.trim() || '';

    // Unique key
    const mid = node.getAttribute('data-mid');
    const key = mid ? `mid_${mid}` : `${sender}::${text.substring(0, 100)}`;

    if (!allMessages.has(key)) {
      allMessages.set(key, { sender: sender || 'Unknown', text, timestamp, _order: allMessages.size });
    }
  });
}

async function extractAll(onProgress) {
  if (isExtracting) return [];
  isExtracting = true;
  allMessages.clear();

  const scroller = findMessageScrollContainer();

  if (!scroller) {
    scrapeVisible();
    isExtracting = false;
    return buildResult();
  }

  // Scroll to top of messages first (loads oldest messages)
  scroller.scrollTop = 0;
  await sleep(1500);
  scrapeVisible();
  onProgress(allMessages.size);

  let lastSize = allMessages.size;
  let stuckCount = 0;

  while (stuckCount < 8) {
    scroller.scrollTop += Math.floor(scroller.clientHeight * 0.75);
    await sleep(900);
    scrapeVisible();

    const currentSize = allMessages.size;
    onProgress(currentSize);

    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 30;

    if (currentSize === lastSize) stuckCount++;
    else { stuckCount = 0; lastSize = currentSize; }

    if (atBottom && stuckCount >= 3) break;
  }

  isExtracting = false;
  return buildResult();
}

function buildResult() {
  return Array.from(allMessages.values())
    .sort((a, b) => a._order - b._order)
    .map((m, i) => ({ number: i + 1, sender: m.sender, text: m.text, timestamp: m.timestamp }));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractMessages') {
    allMessages.clear();
    scrapeVisible();
    sendResponse({ messages: buildResult() });
    allMessages.clear();
  }

  if (request.action === 'extractAll') {
    extractAll((count) => {
      chrome.runtime.sendMessage({ action: 'progress', count }).catch(() => {});
    }).then(messages => {
      sendResponse({ messages });
    });
    return true;
  }
});

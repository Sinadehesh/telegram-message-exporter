// Telegram Message Exporter - Content Script
// Fixed for Telegram Web A (web.telegram.org/a)

let allMessages = new Map();
let isExtracting = false;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function findScrollContainer() {
  // Telegram Web A specific containers (in order of priority)
  const selectors = [
    '.bubbles-inner',
    '.scrollable.scrollable-y',
    '.chat .bubbles',
    '.bubbles',
    '.messages-layout',
    '.chat-list',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.scrollHeight > el.clientHeight + 50) return el;
  }
  // Last resort: find any tall scrollable div
  const all = document.querySelectorAll('div');
  for (const el of all) {
    const style = window.getComputedStyle(el);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 200
    ) return el;
  }
  return null;
}

function scrapeVisible() {
  // Telegram Web A message selectors
  const selectors = [
    '.message.spoilers-container',
    '.bubble:not(.service)',
    '[data-mid]',
    '.bubble',
  ];

  let nodes = [];
  for (const sel of selectors) {
    const found = [...document.querySelectorAll(sel)];
    if (found.length > 1) { nodes = found; break; }
  }

  nodes.forEach(node => {
    // Skip service/system messages
    if (
      node.classList.contains('service') ||
      node.classList.contains('is-date') ||
      node.getAttribute('data-is-service') === 'true'
    ) return;

    // Get sender
    let sender = '';
    const senderEl = node.querySelector('.peer-title, .name, [class*="name"], .message-author');
    if (senderEl) sender = senderEl.innerText.trim();

    // Get text — Telegram Web A uses .message inside .bubble
    let text = '';
    const textCandidates = [
      node.querySelector('.message'),
      node.querySelector('.text-content'),
      node.querySelector('[class*="message-text"]'),
      node.querySelector('span.translatable-message'),
    ];
    for (const el of textCandidates) {
      if (el && el.innerText.trim()) { text = el.innerText.trim(); break; }
    }
    // If still nothing, use the whole bubble text
    if (!text) text = node.innerText.trim();
    if (!text || text.length < 1) return;

    // Get timestamp
    let timestamp = '';
    const timeEl = node.querySelector('time, .time, [class*="time"]');
    if (timeEl) timestamp = timeEl.getAttribute('datetime') || timeEl.innerText.trim() || '';

    // Unique key: prefer data-mid, else fingerprint
    const mid = node.getAttribute('data-mid');
    const key = mid ? `mid_${mid}` : `${sender}::${text.substring(0, 100)}`;

    if (!allMessages.has(key)) {
      allMessages.set(key, {
        sender: sender || 'Unknown',
        text,
        timestamp,
        _order: allMessages.size,
      });
    }
  });
}

async function extractAll(onProgress) {
  if (isExtracting) return [];
  isExtracting = true;
  allMessages.clear();

  const scroller = findScrollContainer();

  if (!scroller) {
    scrapeVisible();
    isExtracting = false;
    return buildResult();
  }

  // Scroll to very top first to start from beginning
  scroller.scrollTop = 0;
  await sleep(1500); // wait for Telegram to load older messages
  scrapeVisible();
  onProgress(allMessages.size);

  let lastSize = allMessages.size;
  let stuckCount = 0;
  const STUCK_LIMIT = 8;

  while (stuckCount < STUCK_LIMIT) {
    const prevTop = scroller.scrollTop;

    // Scroll down by ~80% of viewport
    scroller.scrollTop += Math.floor(scroller.clientHeight * 0.75);
    await sleep(800); // give Telegram time to render new messages

    scrapeVisible();
    const currentSize = allMessages.size;
    onProgress(currentSize);

    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 20;

    if (currentSize === lastSize) {
      stuckCount++;
    } else {
      stuckCount = 0;
      lastSize = currentSize;
    }

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
    return true; // keep channel open for async response
  }
});

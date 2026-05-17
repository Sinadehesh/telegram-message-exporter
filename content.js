// Telegram Message Exporter - Content Script
// Full extraction via auto-scroll

let allMessages = new Map();
let isExtracting = false;

function scrapeVisible() {
  const messageSelectors = [
    '[data-mid]',
    '.bubbles-inner .bubble',
    '.messages-container .bubble',
    '.bubble',
    '[class*="message_"]',
    '.message',
  ];

  let messageNodes = [];
  for (const sel of messageSelectors) {
    const found = document.querySelectorAll(sel);
    if (found.length > 2) { messageNodes = Array.from(found); break; }
  }

  messageNodes.forEach((node) => {
    if (
      node.classList.contains('service') ||
      node.classList.contains('Service') ||
      node.getAttribute('data-is-service') === 'true'
    ) return;

    const senderSelectors = ['.peer-title', '.message-author', '.name', '[class*="author"]', '[class*="sender"]'];
    let sender = '';
    for (const s of senderSelectors) {
      const el = node.querySelector(s);
      if (el && el.innerText.trim()) { sender = el.innerText.trim(); break; }
    }

    const textSelectors = ['.text-content', '.message-text', '[class*="messageText"]', '[class*="message-text"]', 'span.translatable-message', '.message'];
    let text = '';
    for (const s of textSelectors) {
      const el = node.querySelector(s);
      if (el && el.innerText.trim()) { text = el.innerText.trim(); break; }
    }
    if (!text && node.innerText) text = node.innerText.trim();
    if (!text || text.length < 1) return;

    const timeSelectors = ['time', '.time', '[class*="time"]', '.message-time'];
    let timestamp = '';
    for (const s of timeSelectors) {
      const el = node.querySelector(s);
      if (el) { timestamp = el.getAttribute('datetime') || el.innerText.trim() || ''; break; }
    }

    const mid = node.getAttribute('data-mid');
    const key = mid || `${sender}::${text.substring(0, 80)}`;

    if (!allMessages.has(key)) {
      // Store scroll position as order proxy
      const rect = node.getBoundingClientRect();
      allMessages.set(key, {
        sender: sender || 'Unknown',
        text,
        timestamp,
        _scrollTop: node.offsetTop || 0,
      });
    }
  });
}

function findScrollContainer() {
  const candidates = [
    document.querySelector('.bubbles'),
    document.querySelector('.scrollable-y'),
    document.querySelector('.messages-container'),
    document.querySelector('[class*="bubbles"]'),
    document.querySelector('[class*="scrollable"]'),
  ];
  return candidates.find(el => el && el.scrollHeight > el.clientHeight) || null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

  // Start from the very top
  scroller.scrollTop = 0;
  await sleep(1000);
  scrapeVisible();
  onProgress(allMessages.size);

  let lastSize = 0;
  let stuckCount = 0;

  while (stuckCount < 6) {
    const prevScrollTop = scroller.scrollTop;
    scroller.scrollTop += scroller.clientHeight * 0.8;
    await sleep(700);
    scrapeVisible();

    const currentSize = allMessages.size;
    onProgress(currentSize);

    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 10;

    if (currentSize === lastSize) {
      stuckCount++;
    } else {
      stuckCount = 0;
      lastSize = currentSize;
    }

    if (atBottom && stuckCount >= 2) break;
  }

  isExtracting = false;
  return buildResult();
}

function buildResult() {
  return Array.from(allMessages.values())
    .sort((a, b) => a._scrollTop - b._scrollTop)
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
    return true; // keep channel open for async
  }
});

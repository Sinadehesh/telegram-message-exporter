// Telegram Message Exporter - Content Script
// Selectors confirmed via DOM inspection

if (typeof window.__tgExporterLoaded === 'undefined') {
  window.__tgExporterLoaded = true;

  let allMessages = new Map();
  let isExtracting = false;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function findMessageScrollContainer() {
    // Confirmed class from DOM: "Transition MessageList custom-scroll ..."
    const byClass = [...document.querySelectorAll('div')].find(el =>
      el.classList.contains('MessageList') && el.scrollHeight > el.clientHeight + 100
    );
    if (byClass) return byClass;
    return null;
  }

  function scrapeVisible() {
    // Telegram Web Z uses .Message class for each message bubble
    const nodes = [...document.querySelectorAll('.Message')];

    nodes.forEach(node => {
      if (node.classList.contains('service') || node.classList.contains('is-date')) return;

      // Sender
      let sender = '';
      const senderEl = node.querySelector('.message-title, .peer-title, .sender-title, [class*="title"]');
      if (senderEl) sender = senderEl.innerText.trim();

      // Text content
      let text = '';
      const textEls = [
        node.querySelector('.text-content'),
        node.querySelector('.message-content'),
        node.querySelector('[class*="content"]'),
        node.querySelector('p'),
      ];
      for (const el of textEls) {
        if (el && el.innerText.trim()) { text = el.innerText.trim(); break; }
      }
      if (!text) text = node.innerText.trim();
      if (!text || text.length < 1) return;

      // Timestamp
      let timestamp = '';
      const timeEl = node.querySelector('time, [class*="time"], .MessageMeta');
      if (timeEl) timestamp = timeEl.getAttribute('datetime') || timeEl.innerText.trim() || '';

      // Unique key via data-message-id or fingerprint
      const mid = node.getAttribute('data-message-id') || node.getAttribute('id');
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

    // Start from top to load oldest messages
    scroller.scrollTop = 0;
    await sleep(1500);
    scrapeVisible();
    onProgress(allMessages.size);

    let lastSize = allMessages.size;
    let stuckCount = 0;

    while (stuckCount < 8) {
      scroller.scrollTop += Math.floor(scroller.clientHeight * 0.8);
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
      }).then(messages => sendResponse({ messages }));
      return true;
    }
  });

}

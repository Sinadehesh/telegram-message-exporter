# 📤 Telegram Message Exporter

A Chrome/Edge browser extension that lets you **copy and export numbered messages** from any Telegram Web chat, group, or channel.

> Every message gets a unique number starting from **#1** — so you can always find and reference them later.

---

## ✨ Features

- 🔢 **Auto-numbered messages** — each message gets `[1]`, `[2]`, `[3]`... for easy reference
- 📋 **Copy to clipboard** — paste anywhere instantly
- 💾 **Download as file** — save your export locally
- 📄 **4 export formats**: `TXT`, `JSON`, `CSV`, `Markdown`
- 👤 **Sender names** included when available
- 🕐 **Timestamps** included when available
- ⚡ Works with **chats, groups, and channels** on [web.telegram.org](https://web.telegram.org)

---

## 📖 How to Use

1. Go to [web.telegram.org](https://web.telegram.org) and **open a chat, group, or channel**
2. Scroll to load the messages you want to export
3. Click the **Telegram Exporter** extension icon
4. Choose your export format (TXT / JSON / CSV / Markdown)
5. Click **"Extract Messages"**
6. Then either **Copy to Clipboard** or **Download File**

---

## 🚀 Installation

1. Clone this repo:
   ```bash
   git clone https://github.com/Sinadehesh/telegram-message-exporter.git
   ```
2. Go to `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the folder
4. The icon appears in your toolbar ✅

> **Icons:** Run `python generate_icons.py` (requires `cairosvg`) to generate PNG icons, or create them manually from `icons/icon.svg`.

---

## 📁 Export Formats

| Format | Best for |
|--------|----------|
| **TXT** | Reading, pasting into notes |
| **JSON** | Developers, data processing |
| **CSV** | Excel/Sheets, data analysis |
| **Markdown** | Notion, Obsidian, GitHub |

---

## ⚙️ Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Read the current Telegram Web tab |
| `scripting` | Inject the message extractor into the page |
| `downloads` | Save exported files to your device |
| `host_permissions: web.telegram.org` | Restrict to Telegram Web only |

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension API
- Vanilla JS, HTML, CSS — zero dependencies
- Works with both Telegram Web **K** and **A** versions

---

## 📜 License

MIT

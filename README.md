<div align="center">

# ⚡ LeetCommit

### Automatically push your LeetCode solutions to GitHub the moment you hit Accepted.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)
[![Open Source](https://img.shields.io/badge/Open-Source-orange?style=for-the-badge&logo=github)](https://github.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)](./CONTRIBUTING.md)

**LeetCode → GitHub. Automatic. Structured. Zero effort.**

[Install Extension](#-installation) · [How It Works](#-how-it-works) · [Features](#-features) · [Contributing](#-contributing)

---

<!-- Replace this with an actual screen recording GIF -->
![LeetCommit Demo](https://via.placeholder.com/800x400/0d1117/58a6ff?text=LeetCommit+Demo+GIF+Here)

</div>

---

## 🤔 What is LeetCommit?

LeetCommit is a free, open-source **Chrome and Brave browser extension** that automatically syncs your accepted **LeetCode solutions to GitHub** — the moment you pass all test cases.

No copy-paste. No manual commits. No forgetting to save your work.

You solve the problem. LeetCommit handles the rest.

> **Why does this matter?**  
> GitHub is your developer portfolio. Every recruiter checks it. LeetCommit makes sure every problem you solve shows up as a real commit — building your GitHub streak and showcasing your consistency automatically.

---

## ✨ Features

- 🚀 **Auto-push on Accepted** — detects when LeetCode shows "Accepted" and instantly commits your solution to GitHub
- 📁 **Structured folders** — organizes by difficulty: `Easy/`, `Medium/`, `Hard/`
- 📝 **Auto-generated README per problem** — includes difficulty, topics, runtime, memory, and date solved
- 💬 **Metadata header in code** — every solution file includes problem number, topics, and performance stats as a comment
- 🌐 **All languages supported** — Python, Java, C++, JavaScript, TypeScript, Go, Rust, Kotlin, Swift, and more
- 🔒 **Private repo support** — keep your solutions private if you want
- 📊 **Stats dashboard** — track Easy / Medium / Hard solved count right in the extension popup
- 🔘 **Manual push button** — injected into LeetCode's UI as a backup if auto-detect misses
- 🔑 **PAT & OAuth support** — connect via Personal Access Token or GitHub OAuth App
- 🛡️ **100% local** — your token never leaves your device, no backend server involved

---

## 📁 GitHub Repo Structure

After solving problems, your GitHub repo looks like this:

```
leetcode-solutions/
├── Easy/
│   ├── 0001-two-sum/
│   │   ├── solution.py        ← Your code with metadata header
│   │   └── README.md          ← Auto-generated problem info
│   └── 0021-merge-two-sorted-lists/
│       ├── solution.java
│       └── README.md
├── Medium/
│   └── 0049-group-anagrams/
│       ├── solution.cpp
│       └── README.md
└── Hard/
    └── 0023-merge-k-sorted-lists/
        ├── solution.go
        └── README.md
```

Each solution file looks like this:

```python
# LeetCode Problem #1: Two Sum
# Difficulty: Easy
# Topics: Array, Hash Table
# Language: Python3
# Runtime: 56 ms | Memory: 14.3 MB
# Solved: 22/06/2026

class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
```

---

## 🔧 Installation

### Method 1 — Load Unpacked (Developer Mode)

1. [Download the latest release](https://github.com/Aditya24Kashyap/LeetCommit/releases) and unzip it
2. Open Chrome or Brave → go to `chrome://extensions/`
3. Toggle **Developer Mode** ON (top-right corner)
4. Click **Load unpacked** → select the `leetcommit/` folder
5. Pin the ⚡ LeetCommit icon to your toolbar

### Method 2 — Chrome Web Store
> Coming soon 🚧

---

## 🔑 Connecting GitHub (Takes 2 minutes)

### Recommended: Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it a name like `leetcommit`
4. Set expiration to **No expiration**
5. Check only the **`repo`** scope
6. Click **Generate token** → copy it immediately (shown only once!)
7. Click the ⚡ LeetCommit icon → paste your token → **Connect**

---

## 🚀 How It Works

```
You submit a LeetCode solution
        ↓
LeetCode shows "Accepted" ✅
        ↓
LeetCommit detects it automatically
        ↓
Extracts: code, difficulty, topics, runtime, memory
        ↓
Pushes solution.{ext} + README.md to your GitHub repo
        ↓
Your GitHub streak grows 📈
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | Chrome Manifest V3 |
| Content Script | Vanilla JavaScript (DOM observer) |
| Background | Service Worker |
| GitHub Integration | GitHub REST API v3 |
| Auth | GitHub PAT / OAuth 2.0 |
| Storage | chrome.storage.local |

---

## 🤝 Contributing

Contributions are what make open source amazing. Any contribution you make is **greatly appreciated**.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full guidelines.

Quick steps:
1. Fork the repo
2. Create your branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Ideas for contributions
- [ ] GeeksforGeeks support
- [ ] GitLab support
- [ ] Topic-wise folder organization
- [ ] Problem description in README
- [ ] Dark/light popup theme toggle
- [ ] Firefox extension port

---

## 🐛 Known Issues & Fixes

**Solution not pushing automatically?**
→ Use the manual **Push** button injected into LeetCode's editor toolbar

**SHA conflict error on GitHub?**
→ Already handled with automatic retry logic in v1.0+

**Code not being extracted?**
→ Refresh the LeetCode page and try again. Monaco editor sometimes loads late.

---

## 📊 Why LeetCommit over alternatives?

| Feature | LeetCommit | LeetHub v2 | LeetSync |
|---------|-----------|------------|---------|
| Manifest V3 | ✅ | ❌ | ❌ |
| Auto README per problem | ✅ | ❌ | ❌ |
| Stats dashboard | ✅ | ✅ | ❌ |
| Manual push button | ✅ | ✅ | ❌ |
| PAT + OAuth both | ✅ | ✅ | ✅ |
| Open Source | ✅ | ✅ | ✅ |
| SHA conflict auto-retry | ✅ | ❌ | ❌ |

---

## 🔒 Privacy & Security

- All processing happens **100% locally on your device**
- Your GitHub token is stored in `chrome.storage.local` (encrypted by Chrome)
- No data is sent to any third-party server — only GitHub's official API
- Extension only accesses `leetcode.com` and `api.github.com`
- Full source code is open for audit right here

---

## 📜 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.

---

## ⭐ Support

If LeetCommit helps you — **star this repo!** It helps others find it and motivates continued development.

[![Star History](https://img.shields.io/github/stars/Aditya24Kashyap/LeetCommit?style=social)](https://github.com/Aditya24Kashyap/LeetCommit)

---

<div align="center">

Made with ❤️ for the developer community

**Stop copy-pasting. Start committing.**

</div>

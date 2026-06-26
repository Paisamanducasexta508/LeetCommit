// ==========================================
// LeetPush - LeetCode Content Script
// Detects accepted submissions & extracts data
// ==========================================

let lastPushedKey = null;
let pushInProgress = false;

// ── Main Observer ───────────────────────────────────────────────────────────

function init() {
  // Watch for DOM changes (LeetCode is a SPA)
  const observer = new MutationObserver(debounce(scanForAcceptedSubmission, 500));
  observer.observe(document.body, { childList: true, subtree: true });
  injectManualPushButton();
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Submission Detection ────────────────────────────────────────────────────

function scanForAcceptedSubmission() {
  // LeetCode shows "Accepted" in the result area
  const resultTexts = [
    ...document.querySelectorAll('[data-e2e-locator="submission-result"]'),
    ...document.querySelectorAll('.text-green-s'),
    ...document.querySelectorAll('[class*="accepted"]'),
  ];

  for (const el of resultTexts) {
    const text = el.textContent?.trim();
    if (text === "Accepted") {
      const key = buildSubmissionKey();
      if (key && key !== lastPushedKey && !pushInProgress) {
        lastPushedKey = key;
        handleAcceptedSubmission();
        return;
      }
    }
  }
}

function buildSubmissionKey() {
  const title = extractProblemTitle();
  const code = extractCode();
  if (!title || !code) return null;
  return `${title}::${code.slice(0, 50)}`;
}

// ── Data Extraction ─────────────────────────────────────────────────────────

function extractProblemTitle() {
  // Multiple selectors for different LeetCode UI versions
  const selectors = [
    '[data-cy="question-title"]',
    '.text-title-large a',
    'a[href*="/problems/"] .text-base',
    '.question-title h4',
    '.css-v3d350',
    '[class*="title"] a[href*="/problems/"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  // Fallback: extract from URL
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  if (match) {
    return match[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  return null;
}

function extractProblemNumber() {
  // Try from the question list item or page header
  const selectors = [
    '[data-cy="question-title"]',
    '.text-label-1',
    '.question-title',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    const match = text?.match(/^(\d+)\./);
    if (match) return parseInt(match[1]);
  }
  // Try the URL slug against problem number (not available directly)
  // Use backend API via content script fetch
  return extractNumberFromPage();
}

function extractNumberFromPage() {
  // Look for the number in various data sources on the page
  const allText = document.body.innerText;
  const patterns = [
    /Problem\s+#?(\d+)/i,
    /^(\d+)\.\s+/m,
  ];
  for (const p of patterns) {
    const m = allText.match(p);
    if (m) return parseInt(m[1]);
  }
  return 0;
}

function extractDifficulty() {
  const selectors = [
    '[diff]',
    '.text-difficulty-easy', '.text-difficulty-medium', '.text-difficulty-hard',
    '.text-green-s:not([data-e2e-locator])',
    '[class*="difficulty"]',
  ];
  const diffMap = { easy: "Easy", medium: "Medium", hard: "Hard" };
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent?.trim().toLowerCase();
      if (diffMap[text]) return diffMap[text];
    }
  }
  // Check for color-coded difficulty badges
  const diffTexts = ["Easy", "Medium", "Hard"];
  for (const diff of diffTexts) {
    if (document.body.innerHTML.includes(`>${diff}<`)) return diff;
  }
  return "Unknown";
}

function extractTopics() {
  const topics = [];
  // LeetCode shows topics in the problem description sidebar
  const topicSelectors = [
    '[class*="topic-tag"]',
    'a[href*="/tag/"]',
    '[data-cy="topic-tags"] a',
    '.topic-tag',
  ];
  for (const sel of topicSelectors) {
    document.querySelectorAll(sel).forEach(el => {
      const text = el.textContent?.trim();
      if (text && !topics.includes(text)) topics.push(text);
    });
  }
  return topics;
}

function extractCode() {
  // Monaco editor (main LeetCode editor)
  const monacoLines = document.querySelectorAll('.view-lines .view-line');
  if (monacoLines.length > 0) {
    return [...monacoLines].map(l => l.textContent).join("\n");
  }

  // CodeMirror fallback
  const cm = document.querySelector('.CodeMirror');
  if (cm?.CodeMirror) return cm.CodeMirror.getValue();

  // Submission result page shows the submitted code
  const codeBlock = document.querySelector('pre.language-', '.code-area pre');
  if (codeBlock) return codeBlock.textContent;

  return null;
}

function extractLanguage() {
  // Language selector button text
  const selectors = [
    'button[id*="lang"]',
    '[data-cy="lang-select"]',
    '.ant-select-selection-item',
    'button[class*="lang"]',
    '[class*="language-select"] button',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && !text.includes("Select")) return text;
  }
  return "Unknown";
}

function extractRuntimeMemory() {
  const runtime = { time: null, memory: null };
  // Look for runtime/memory in accepted result panel
  const panels = document.querySelectorAll('[class*="runtime"], [class*="memory"], [data-e2e-locator*="runtime"]');
  panels.forEach(el => {
    const text = el.textContent;
    if (/ms/i.test(text) && !runtime.time) runtime.time = text.match(/[\d.]+\s*ms/)?.[0];
    if (/mb/i.test(text) && !runtime.memory) runtime.memory = text.match(/[\d.]+\s*MB/i)?.[0];
  });

  // Alternative: look for the stats grid
  document.querySelectorAll('[class*="stat"]').forEach(el => {
    const text = el.textContent;
    if (/runtime/i.test(text)) {
      runtime.time = text.match(/[\d.]+\s*ms/)?.[0];
    }
    if (/memory/i.test(text)) {
      runtime.memory = text.match(/[\d.]+\s*MB/i)?.[0];
    }
  });

  return runtime;
}

function extractTestCases() {
  const testArea = document.querySelector('[class*="testcase"], [data-cy="testcase-input"]');
  return testArea?.textContent?.trim() || null;
}

// ── Push Submission ─────────────────────────────────────────────────────────

async function handleAcceptedSubmission() {
  pushInProgress = true;
  showToast("🔍 Accepted! Pushing to GitHub...", "info");

  try {
    // Small delay to let the page fully render stats
    await sleep(1500);

    const runtimeMemory = extractRuntimeMemory();
    const title = extractProblemTitle();
    const number = extractProblemNumber();

    // Fetch problem number from LeetCode API if not found in DOM
    let problemNumber = number;
    if (!problemNumber) {
      problemNumber = await fetchProblemNumber(toSlug(title));
    }

    const submission = {
      problemTitle: title,
      problemNumber: problemNumber || 0,
      difficulty: extractDifficulty(),
      topics: extractTopics(),
      language: extractLanguage(),
      code: extractCode(),
      testCases: extractTestCases(),
      runtime: runtimeMemory.time,
      memory: runtimeMemory.memory,
      timestamp: Date.now(),
      url: window.location.href
    };

    if (!submission.code) {
      showToast("⚠️ Could not extract code. Use manual push.", "warning");
      pushInProgress = false;
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: "push_submission",
      submission
    });

    if (response?.success) {
      showToast(`✅ Pushed to GitHub! View →`, "success", response.url);
    } else {
      showToast(`❌ Push failed: ${response?.error || "Unknown error"}`, "error");
    }
  } catch (e) {
    showToast(`❌ Error: ${e.message}`, "error");
    console.error("[LeetPush]", e);
  }

  pushInProgress = false;
}

async function fetchProblemNumber(slug) {
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { question(titleSlug: "${slug}") { questionFrontendId } }`
      })
    });
    const data = await res.json();
    return parseInt(data?.data?.question?.questionFrontendId) || 0;
  } catch (_) {
    return 0;
  }
}

function toSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Manual Push Button ──────────────────────────────────────────────────────

function injectManualPushButton() {
  // Wait for action bar to appear
  const tryInject = () => {
    const actionBar = document.querySelector('[class*="action-bar"], [class*="ActionBar"], .flex.items-center.gap-2');
    if (actionBar && !document.getElementById("leetpush-manual-btn")) {
      const btn = document.createElement("button");
      btn.id = "leetpush-manual-btn";
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
        </svg>
        Push
      `;
      btn.title = "Manually push this solution to GitHub";
      btn.style.cssText = `
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; border-radius: 6px;
        background: #238636; color: white; border: none;
        font-size: 13px; font-weight: 500; cursor: pointer;
        font-family: inherit; transition: background 0.2s;
      `;
      btn.onmouseenter = () => btn.style.background = "#2ea043";
      btn.onmouseleave = () => btn.style.background = "#238636";
      btn.onclick = () => handleAcceptedSubmission();
      actionBar.appendChild(btn);
    }
  };

  // Try multiple times as the SPA loads
  [500, 1500, 3000, 5000].forEach(delay => setTimeout(tryInject, delay));
}

// ── Toast Notification ──────────────────────────────────────────────────────

function showToast(message, type = "info", link = null) {
  const existing = document.getElementById("leetpush-toast");
  if (existing) existing.remove();

  const colors = {
    info: "#1f6feb",
    success: "#238636",
    warning: "#d29922",
    error: "#da3633"
  };

  const toast = document.createElement("div");
  toast.id = "leetpush-toast";
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 99999;
    background: #161b22; border: 1px solid ${colors[type]};
    color: #e6edf3; padding: 14px 18px; border-radius: 10px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px; max-width: 340px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    display: flex; align-items: center; gap: 10px;
    animation: leetpush-slide-in 0.3s ease;
  `;

  toast.innerHTML = `
    <style>
      @keyframes leetpush-slide-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
    <span>${message}</span>
    ${link ? `<a href="${link}" target="_blank" style="color:#58a6ff;text-decoration:none;font-size:12px;white-space:nowrap;">Open ↗</a>` : ""}
    <button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:#8b949e;cursor:pointer;font-size:16px;line-height:1;">×</button>
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 6000);
}

// ── Utils ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Start ───────────────────────────────────────────────────────────────────

init();

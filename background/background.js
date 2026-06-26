// ==========================================
// LeetPush - Background Service Worker
// Handles GitHub OAuth & API communication
// ==========================================

const GITHUB_API = "https://api.github.com";

// ── OAuth Flow ──────────────────────────────────────────────────────────────

/**
 * Initiates GitHub OAuth using chrome.identity.launchWebAuthFlow
 * Replace CLIENT_ID with your actual GitHub OAuth App client ID
 */
async function authorizeGitHub() {
  const CLIENT_ID = await getStoredValue("github_client_id");
  if (!CLIENT_ID) {
    return { error: "No client ID configured. Please set your GitHub OAuth App Client ID in settings." };
  }

  const REDIRECT_URI = chrome.identity.getRedirectURL("github");
  const scope = "repo user:email";
  const authURL =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=token`;

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      { url: authURL, interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          resolve({ error: chrome.runtime.lastError?.message || "Auth cancelled" });
          return;
        }

        // GitHub OAuth returns code in URL params for web flow
        const url = new URL(responseUrl);
        const code = url.searchParams.get("code");

        if (!code) {
          // Try to get access_token directly (implicit flow)
          const hashParams = new URLSearchParams(url.hash.replace("#", ""));
          const token = hashParams.get("access_token");
          if (token) {
            await saveToken(token);
            resolve({ success: true, token });
            return;
          }
          resolve({ error: "No authorization code received" });
          return;
        }

        // Exchange code for token via background (requires client secret)
        // For security, client secret should be on YOUR backend server
        // This is a placeholder - see README for server setup
        const CLIENT_SECRET = await getStoredValue("github_client_secret");
        if (!CLIENT_SECRET) {
          resolve({ 
            error: "Client secret required. Add it in extension settings or set up a token exchange server.",
            code: code 
          });
          return;
        }

        try {
          const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
              code: code
            })
          });
          const tokenData = await tokenRes.json();
          if (tokenData.access_token) {
            await saveToken(tokenData.access_token);
            resolve({ success: true, token: tokenData.access_token });
          } else {
            resolve({ error: tokenData.error_description || "Token exchange failed" });
          }
        } catch (e) {
          resolve({ error: e.message });
        }
      }
    );
  });
}

// Alternative: Use a Personal Access Token directly
async function savePersonalAccessToken(token) {
  try {
    const userRes = await fetch(`${GITHUB_API}/user`, {
      headers: { Authorization: `token ${token}`, "User-Agent": "LeetPush-Extension" }
    });
    if (!userRes.ok) throw new Error("Invalid token");
    const user = await userRes.json();
    await chrome.storage.local.set({
      github_token: token,
      github_user: user.login,
      github_avatar: user.avatar_url,
      github_name: user.name || user.login
    });
    return { success: true, user: user.login };
  } catch (e) {
    return { error: e.message };
  }
}

async function saveToken(token) {
  const userRes = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `token ${token}`, "User-Agent": "LeetPush-Extension" }
  });
  const user = await userRes.json();
  await chrome.storage.local.set({
    github_token: token,
    github_user: user.login,
    github_avatar: user.avatar_url,
    github_name: user.name || user.login
  });
}

async function logout() {
  await chrome.storage.local.remove([
    "github_token", "github_user", "github_avatar",
    "github_name", "selected_repo", "stats"
  ]);
  return { success: true };
}

// ── GitHub Repo Operations ──────────────────────────────────────────────────

async function listRepos(token) {
  const repos = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `${GITHUB_API}/user/repos?per_page=100&page=${page}&sort=updated&type=all`,
      { headers: { Authorization: `token ${token}`, "User-Agent": "LeetPush-Extension" } }
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    repos.push(...data.map(r => ({ name: r.full_name, private: r.private, url: r.html_url })));
    if (data.length < 100) break;
    page++;
  }
  return repos;
}

async function createRepo(token, repoName, isPrivate = true) {
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      "User-Agent": "LeetPush-Extension",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: repoName,
      description: "My LeetCode solutions - auto-synced by LeetPush 🚀",
      private: isPrivate,
      auto_init: true
    })
  });
  const data = await res.json();
  if (data.full_name) return { success: true, repo: data.full_name };
  return { error: data.message || "Failed to create repo" };
}

// ── File Upload to GitHub ───────────────────────────────────────────────────

async function pushToGitHub(submission) {
  const storage = await chrome.storage.local.get(["github_token", "selected_repo", "stats"]);
  const { github_token: token, selected_repo: repo } = storage;

  if (!token || !repo) {
    return { error: "Not configured. Set up GitHub auth and repo first." };
  }

  const { problemTitle, problemNumber, difficulty, topics, language, code, testCases, runtime, memory, timestamp } = submission;

  // Build structured file path: difficulty/problemNumber-title/solution.ext
  const slug = `${String(problemNumber).padStart(4, "0")}-${toSlug(problemTitle)}`;
  const ext = languageExtension(language);
  const folder = `${difficulty}/${slug}`;
  const solutionPath = `${folder}/solution.${ext}`;
  const readmePath = `${folder}/README.md`;

  // Build solution file with header comment
  const solutionContent = buildSolutionFile(submission, ext);
  const readmeContent = buildReadme(submission);

  const results = await Promise.allSettled([
    upsertFile(token, repo, solutionPath, solutionContent, `✅ Add ${problemTitle} solution`),
    upsertFile(token, repo, readmePath, readmeContent, `📝 Add ${problemTitle} README`)
  ]);

  // Update stats
  await updateStats(storage.stats, submission);

  const errors = results.filter(r => r.status === "rejected").map(r => r.reason?.message);
  if (errors.length > 0) return { error: errors.join(", ") };

  return {
    success: true,
    url: `https://github.com/${repo}/tree/main/${folder}`
  };
}

async function upsertFile(token, repo, path, content, message) {
  const headers = {
    Authorization: `token ${token}`,
    "User-Agent": "LeetPush-Extension",
    "Content-Type": "application/json"
  };

  // Check if file exists to get its SHA (needed for update)
  let sha = null;
  try {
    const check = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, { headers });
    if (check.ok) {
      const existing = await check.json();
      sha = existing.sha;
    }
  } catch (_) {}

  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    ...(sha && { sha })
  };

  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `Failed to push ${path}`);
  }
  return res.json();
}

// ── Stats Tracking ──────────────────────────────────────────────────────────

async function updateStats(currentStats, submission) {
  const stats = currentStats || { easy: 0, medium: 0, hard: 0, total: 0, languages: {}, lastSolvedAt: null };
  const diff = (submission.difficulty || "").toLowerCase();
  if (["easy", "medium", "hard"].includes(diff)) stats[diff]++;
  stats.total++;
  const lang = submission.language || "unknown";
  stats.languages[lang] = (stats.languages[lang] || 0) + 1;
  stats.lastSolvedAt = new Date().toISOString();
  await chrome.storage.local.set({ stats });
}

async function getStats() {
  const s = await chrome.storage.local.get("stats");
  return s.stats || { easy: 0, medium: 0, hard: 0, total: 0, languages: {}, lastSolvedAt: null };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function languageExtension(lang) {
  const map = {
    python: "py", python3: "py", javascript: "js", typescript: "ts",
    java: "java", cpp: "cpp", "c++": "cpp", c: "c", cs: "cs", "c#": "cs",
    ruby: "rb", swift: "swift", kotlin: "kt", go: "go", rust: "rs",
    scala: "scala", php: "php", dart: "dart", r: "r"
  };
  return map[(lang || "").toLowerCase()] || "txt";
}

function buildSolutionFile(sub, ext) {
  const commentStyle = getCommentStyle(ext);
  const header = [
    `${commentStyle.start} LeetCode Problem #${sub.problemNumber}: ${sub.problemTitle}`,
    `${commentStyle.line} Difficulty: ${sub.difficulty}`,
    `${commentStyle.line} Topics: ${(sub.topics || []).join(", ")}`,
    `${commentStyle.line} Language: ${sub.language}`,
    `${commentStyle.line} Runtime: ${sub.runtime || "N/A"} | Memory: ${sub.memory || "N/A"}`,
    `${commentStyle.line} Solved: ${new Date(sub.timestamp).toLocaleDateString()}`,
    `${commentStyle.end}`,
    "",
    sub.code
  ].join("\n");
  return header;
}

function getCommentStyle(ext) {
  if (ext === "py" || ext === "rb" || ext === "r") {
    return { start: "#", line: "#", end: "#" };
  }
  if (ext === "html") {
    return { start: "<!--", line: "   ", end: "-->" };
  }
  return { start: "/*", line: " *", end: " */" };
}

function buildReadme(sub) {
  const diffEmoji = { Easy: "🟢", Medium: "🟡", Hard: "🔴" };
  const emoji = diffEmoji[sub.difficulty] || "⚪";

  return `# ${emoji} #${sub.problemNumber} - ${sub.problemTitle}

## Problem Info
| Field | Value |
|-------|-------|
| **Difficulty** | ${sub.difficulty} |
| **Topics** | ${(sub.topics || []).join(", ") || "N/A"} |
| **Language** | ${sub.language} |
| **Runtime** | ${sub.runtime || "N/A"} |
| **Memory** | ${sub.memory || "N/A"} |
| **Solved** | ${new Date(sub.timestamp).toLocaleDateString()} |

## Solution
\`\`\`${languageExtension(sub.language)}
${sub.code}
\`\`\`

${sub.testCases ? `## Test Cases
\`\`\`
${sub.testCases}
\`\`\`` : ""}

---
*Auto-synced by [LeetPush](https://github.com/yourusername/leetpush) 🚀*
`;
}

function getStoredValue(key) {
  return chrome.storage.local.get(key).then(r => r[key] || null);
}

// ── Message Router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case "authorize_github":
        sendResponse(await authorizeGitHub());
        break;
      case "save_pat":
        sendResponse(await savePersonalAccessToken(message.token));
        break;
      case "logout":
        sendResponse(await logout());
        break;
      case "list_repos": {
        const { github_token } = await chrome.storage.local.get("github_token");
        if (!github_token) { sendResponse({ error: "Not authenticated" }); break; }
        sendResponse({ repos: await listRepos(github_token) });
        break;
      }
      case "create_repo": {
        const { github_token } = await chrome.storage.local.get("github_token");
        if (!github_token) { sendResponse({ error: "Not authenticated" }); break; }
        sendResponse(await createRepo(github_token, message.repoName, message.isPrivate));
        break;
      }
      case "set_repo":
        await chrome.storage.local.set({ selected_repo: message.repo });
        sendResponse({ success: true });
        break;
      case "push_submission":
        sendResponse(await pushToGitHub(message.submission));
        break;
      case "get_stats":
        sendResponse(await getStats());
        break;
      case "get_status": {
        const data = await chrome.storage.local.get([
          "github_token", "github_user", "github_avatar",
          "github_name", "selected_repo", "stats"
        ]);
        sendResponse(data);
        break;
      }
      case "save_settings": {
        await chrome.storage.local.set({
          github_client_id: message.clientId,
          github_client_secret: message.clientSecret
        });
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ error: "Unknown action" });
    }
  })();
  return true; // keep message channel open for async
});

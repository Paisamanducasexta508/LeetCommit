// ==========================================
// LeetPush — Popup Controller
// ==========================================

// ── Helpers ────────────────────────────────────────────────────────────────

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function setAlert(id, msg, type = "info") {
  const el = document.getElementById(id);
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
}

function clearAlert(id) {
  const el = document.getElementById(id);
  el.className = "alert";
  el.textContent = "";
}

function setLoading(btn, loading, label = "") {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${label || "Loading…"}`;
  } else {
    btn.disabled = false;
  }
}

function msg(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

// ── Tab Switching ───────────────────────────────────────────────────────────

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const tabGroup = tab.closest(".view").querySelectorAll(".tab");
    tabGroup.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const id = tab.dataset.tab;
    // Hide all sibling tab panels
    tab.closest(".view").querySelectorAll("[id^='tab-']").forEach(p => (p.style.display = "none"));
    document.getElementById(`tab-${id}`).style.display = "";
  });
});

// ── Init ────────────────────────────────────────────────────────────────────

async function init() {
  // Set redirect URI display
  const redirectEl = document.getElementById("redirect-uri");
  if (redirectEl) redirectEl.textContent = chrome.identity.getRedirectURL("github");

  const status = await msg("get_status");

  if (!status.github_token) {
    showView("view-auth");
    updateBadge("Setup", false);
    return;
  }

  if (!status.selected_repo) {
    showView("view-setup");
    renderProfile("profile-display", status);
    updateBadge("No Repo", false);
    return;
  }

  showView("view-dashboard");
  updateBadge("Active", true);
  renderProfile("dash-profile", status);
  renderDashboard(status);
}

function updateBadge(text, active) {
  const badge = document.getElementById("status-badge");
  badge.textContent = `● ${text}`;
  badge.style.color = active ? "var(--easy)" : "var(--medium)";
  badge.style.background = active ? "rgba(0,184,163,0.1)" : "rgba(255,161,22,0.1)";
  badge.style.borderColor = active ? "rgba(0,184,163,0.3)" : "rgba(255,161,22,0.3)";
}

function renderProfile(containerId, status) {
  const c = document.getElementById(containerId);
  c.innerHTML = `
    <img src="${status.github_avatar || "https://github.com/identicons/default.png"}" alt="avatar" />
    <div>
      <div class="user-name">${status.github_name || status.github_user || "GitHub User"}</div>
      <div class="user-sub">@${status.github_user || ""}</div>
    </div>
    <span class="connected-badge">✓ Connected</span>
  `;
}

function renderDashboard(status) {
  const stats = status.stats || { easy: 0, medium: 0, hard: 0, total: 0 };
  document.getElementById("stat-easy").textContent = stats.easy || 0;
  document.getElementById("stat-medium").textContent = stats.medium || 0;
  document.getElementById("stat-hard").textContent = stats.hard || 0;
  document.getElementById("stat-total").textContent = stats.total || 0;
  document.getElementById("dash-repo").textContent = status.selected_repo || "Not set";

  const repoLink = document.getElementById("dash-repo-link");
  if (status.selected_repo) {
    repoLink.innerHTML = `<a href="https://github.com/${status.selected_repo}" target="_blank" style="color: var(--accent); font-size: 11px; text-decoration: none;">Open ↗</a>`;
  }
}

// ── Auth: PAT Flow ──────────────────────────────────────────────────────────

document.getElementById("btn-save-pat").addEventListener("click", async () => {
  const token = document.getElementById("pat-input").value.trim();
  if (!token) {
    setAlert("auth-alert", "Please enter your GitHub Personal Access Token.", "error");
    return;
  }
  clearAlert("auth-alert");
  const btn = document.getElementById("btn-save-pat");
  const origHtml = btn.innerHTML;
  setLoading(btn, true, "Verifying…");

  const res = await msg("save_pat", { token });

  if (res?.success) {
    btn.innerHTML = origHtml;
    btn.disabled = false;
    showView("view-setup");
    const status = await msg("get_status");
    renderProfile("profile-display", status);
    updateBadge("No Repo", false);
  } else {
    setAlert("auth-alert", res?.error || "Authentication failed. Check your token.", "error");
    btn.innerHTML = origHtml;
    btn.disabled = false;
  }
});

// ── Auth: OAuth Flow ────────────────────────────────────────────────────────

document.getElementById("btn-save-oauth-settings").addEventListener("click", async () => {
  const clientId = document.getElementById("client-id-input").value.trim();
  const clientSecret = document.getElementById("client-secret-input").value.trim();
  const res = await msg("save_settings", { clientId, clientSecret });
  if (res?.success) setAlert("auth-alert", "Settings saved. Now click Authorize.", "info");
});

document.getElementById("btn-oauth").addEventListener("click", async () => {
  const btn = document.getElementById("btn-oauth");
  const origHtml = btn.innerHTML;
  setLoading(btn, true, "Opening GitHub…");
  clearAlert("auth-alert");

  const res = await msg("authorize_github");

  if (res?.success) {
    btn.innerHTML = origHtml;
    btn.disabled = false;
    showView("view-setup");
    const status = await msg("get_status");
    renderProfile("profile-display", status);
    updateBadge("No Repo", false);
  } else {
    setAlert("auth-alert", res?.error || "OAuth failed. Make sure Client ID is set.", "error");
    btn.innerHTML = origHtml;
    btn.disabled = false;
  }
});

// ── Setup: Repo Selection ───────────────────────────────────────────────────

let selectedRepo = null;

document.getElementById("btn-load-repos").addEventListener("click", async () => {
  const btn = document.getElementById("btn-load-repos");
  const origHtml = btn.innerHTML;
  setLoading(btn, true, "Loading repos…");
  clearAlert("setup-alert");

  const res = await msg("list_repos");
  btn.innerHTML = origHtml;
  btn.disabled = false;

  if (res?.error) {
    setAlert("setup-alert", res.error, "error");
    return;
  }

  const list = document.getElementById("repo-list");
  list.style.display = "block";
  list.innerHTML = "";

  if (!res.repos || res.repos.length === 0) {
    list.innerHTML = `<div class="repo-item" style="color: var(--text2);">No repositories found</div>`;
    return;
  }

  res.repos.forEach(repo => {
    const item = document.createElement("div");
    item.className = "repo-item";
    item.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
      <span class="ri-name">${repo.name}</span>
      <span class="ri-private">${repo.private ? "🔒" : "🌍"}</span>
    `;
    item.addEventListener("click", () => {
      document.querySelectorAll(".repo-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      selectedRepo = repo.name;
      document.getElementById("btn-use-repo").disabled = false;
    });
    list.appendChild(item);
  });
});

document.getElementById("btn-use-repo").addEventListener("click", async () => {
  if (!selectedRepo) return;
  const res = await msg("set_repo", { repo: selectedRepo });
  if (res?.success) {
    showView("view-dashboard");
    updateBadge("Active", true);
    const status = await msg("get_status");
    renderProfile("dash-profile", status);
    renderDashboard(status);
  }
});

document.getElementById("btn-create-repo").addEventListener("click", async () => {
  const name = document.getElementById("new-repo-name").value.trim();
  const isPrivate = document.getElementById("new-repo-private").value === "true";
  if (!name) {
    setAlert("setup-alert", "Please enter a repository name.", "error");
    return;
  }
  const btn = document.getElementById("btn-create-repo");
  const origHtml = btn.innerHTML;
  setLoading(btn, true, "Creating…");
  clearAlert("setup-alert");

  const res = await msg("create_repo", { repoName: name, isPrivate });
  btn.innerHTML = origHtml;
  btn.disabled = false;

  if (res?.success) {
    await msg("set_repo", { repo: res.repo });
    showView("view-dashboard");
    updateBadge("Active", true);
    const status = await msg("get_status");
    renderProfile("dash-profile", status);
    renderDashboard(status);
  } else {
    setAlert("setup-alert", res?.error || "Failed to create repository.", "error");
  }
});

// ── Dashboard Actions ───────────────────────────────────────────────────────

document.getElementById("btn-change-repo").addEventListener("click", () => {
  showView("view-setup");
  updateBadge("No Repo", false);
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  if (!confirm("Disconnect GitHub? Your local stats will be cleared.")) return;
  await msg("logout");
  showView("view-auth");
  updateBadge("Setup", false);
  document.getElementById("pat-input").value = "";
});

// ── Boot ────────────────────────────────────────────────────────────────────

init();

// Minimal client-side logic to load GitHub repos, allow basic filters,
// and show project detail modal with README rendered as markdown.
//
// Default username set to the current user; you can change it in the UI.
// Optional token can be provided for higher rate/ private repos (stored in sessionStorage).

const DEFAULT_USERNAME = "erwanngao-maker";

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

let repos = [];
let curated = {}; // keyed by repo name from /projects/projects.json if present

// UI elements
const usernameInput = $("#github-username");
const tokenInput = $("#github-token");
const loadBtn = $("#load-btn");
const clearTokenBtn = $("#clear-token");
const ghLink = $("#gh-username-link");
const projectsGrid = $("#projects-grid");
const searchInput = $("#search");
const langFilter = $("#lang-filter");
const projectsEmpty = $("#projects-empty");
const projectModal = $("#project-modal");
const projectDetail = $("#project-detail");
const modalClose = $("#modal-close");
const resumeLink = $("#resume-download");
const emailLink = $("#email-link");
const socialGithub = $("#social-github");
const socialLinkedIn = $("#social-linkedin");
const themeToggle = $("#theme-toggle");
const themeIcon = $("#theme-icon");

// Initialize values
usernameInput.value = DEFAULT_USERNAME;
ghLink.textContent = DEFAULT_USERNAME;
ghLink.href = `https://github.com/${DEFAULT_USERNAME}`;
resumeLink.href = "./assets/img/CV_260126.pdf"; // replace with your resume url if available
emailLink.href = "mailto:erwann.gao@gmail.com";
emailLink.textContent = "erwann.gao@gmail.com";
socialGithub.href = `https://github.com/${DEFAULT_USERNAME}`;
socialLinkedIn.href = "#"; // fill if you have one

// Theme (dark mode) handling
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    themeIcon.textContent = "☀️";
  } else {
    document.documentElement.classList.remove("dark");
    themeIcon.textContent = "🌙";
  }
  localStorage.setItem("theme", theme);
}
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark";
  applyTheme(next);
});
applyTheme(localStorage.getItem("theme") || "dark");

// helpers
function sessionToken() {
  return sessionStorage.getItem("GHTOKEN") || "";
}
function setSessionToken(t) {
  if (t) sessionStorage.setItem("GHTOKEN", t);
  else sessionStorage.removeItem("GHTOKEN");
}

// Load token from sessionStorage into input on init
tokenInput.value = sessionToken();

// Clear token button
clearTokenBtn.addEventListener("click", () => {
  setSessionToken("");
  tokenInput.value = "";
  alert("Token cleared from this session.");
});

// Build headers (include accept for topics when needed)
function buildHeaders(acceptPreview = false) {
  const headers = { "Content-Type": "application/json" };
  const t = sessionToken() || tokenInput.value.trim();
  if (t) headers["Authorization"] = `token ${t}`;
  if (acceptPreview)
    headers["Accept"] = "application/vnd.github.mercy-preview+json";
  return headers;
}

// Fetch curated projects JSON if present and merge it
async function loadCurated(username) {
  try {
    const res = await fetch("/projects/projects.json", { cache: "no-store" });
    if (!res.ok) return {};
    const json = await res.json();
    // Expecting array or object keyed by repo name
    if (Array.isArray(json)) {
      const obj = {};
      for (const p of json) {
        if (p.repo) obj[p.repo] = p;
      }
      return obj;
    }
    return json || {};
  } catch (e) {
    return {};
  }
}

// Fetch repos for username
async function fetchRepos(username) {
  const url = `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data;
}

// Optionally fetch topics for a repo (only when opening a detail)
async function fetchTopics(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/topics`;
  const res = await fetch(url, { headers: buildHeaders(true) });
  if (!res.ok) return [];
  const json = await res.json();
  return json.names || [];
}

// Fetch README (render markdown)
async function fetchReadme(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.content) {
    // base64 decode
    const decoded = atob(json.content.replace(/\n/g, ""));
    return decoded;
  }
  return null;
}

// Render cards
function renderGrid(list) {
  projectsGrid.innerHTML = "";
  if (!list.length) {
    projectsEmpty.classList.remove("hidden");
    return;
  } else {
    projectsEmpty.classList.add("hidden");
  }

  for (const r of list) {
    const card = document.createElement("article");
    card.className =
      "rounded-lg border p-4 bg-white dark:bg-slate-800 shadow-sm";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="font-semibold text-lg"><a href="#" data-repo="${
            r.full_name
          }" class="project-link">${r.name}</a></h3>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300 card-clamp">${
            r.description || (r._curated && r._curated.short) || "—"
          }</p>
          <div class="mt-3 flex flex-wrap gap-2 text-xs">${
            r._curated && r._curated.tags
              ? r._curated.tags
                  .map(
                    (t) =>
                      `<span class="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700">${t}</span>`
                  )
                  .join("")
              : r.language
              ? `<span class="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700">${r.language}</span>`
              : ""
          }</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-sm text-slate-500 dark:text-slate-400">★ ${
            r.stargazers_count || 0
          }</div>
          <div class="mt-4 flex flex-col gap-2">
            <a class="inline-block text-xs px-2 py-1 rounded-md border" href="${
              r.homepage || r.html_url
            }" target="_blank">Open</a>
            <a class="inline-block text-xs px-2 py-1 rounded-md border" href="${
              r.html_url
            }" target="_blank">Repo</a>
          </div>
        </div>
      </div>
    `;
    projectsGrid.appendChild(card);
  }

  // attach listeners
  $$(".project-link").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const full = e.currentTarget.dataset.repo; // owner/repo
      openProject(full);
    });
  });
}

// Filter utilities
function buildLangOptions(list) {
  const langs = Array.from(
    new Set(list.map((r) => r.language).filter(Boolean))
  ).sort();
  langFilter.innerHTML =
    '<option value="">All languages</option>' +
    langs.map((l) => `<option value="${l}">${l}</option>`).join("");
}
function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const lang = langFilter.value;
  const filtered = repos.filter((r) => {
    if (lang && r.language !== lang) return false;
    if (!q) return true;
    const hay = [
      r.name,
      r.description,
      r.language,
      r._curated && r._curated.tags ? r._curated.tags.join(" ") : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  renderGrid(filtered);
}

// Open project detail modal (hash controlled)
async function openProject(fullName) {
  history.replaceState(null, "", `#/project/${fullName}`);
  const [owner, repo] = fullName.split("/");
  projectModal.classList.remove("hidden");
  projectDetail.innerHTML = `<h2 class="text-xl font-bold mb-2">${repo}</h2><div class="text-sm text-slate-500 mb-4">Loading details…</div>`;

  // find repo in repos list
  const r = repos.find(
    (x) => x.full_name.toLowerCase() === fullName.toLowerCase()
  );
  // fetch curated data if present
  const curatedData = r && r._curated ? r._curated : null;

  try {
    const [topics, readme] = await Promise.all([
      fetchTopics(owner, repo).catch(() => []),
      fetchReadme(owner, repo).catch(() => null),
    ]);

    let mdHtml = "";
    if (readme) {
      const rawHtml = marked.parse(readme);
      mdHtml = DOMPurify.sanitize(rawHtml, {
        ADD_TAGS: ["iframe"],
        ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
      });
    } else {
      mdHtml = '<p class="text-sm text-slate-500">No README found.</p>';
    }

    projectDetail.innerHTML = `
      <div class="mb-2">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold">${r.name}</h2>
            <div class="text-sm text-slate-500">${r.description || ""}</div>
            <div class="mt-2 text-xs text-slate-400">Updated ${new Date(
              r.updated_at
            ).toLocaleDateString()} • ★ ${r.stargazers_count}</div>
            <div class="mt-3 flex gap-2">${(curatedData && curatedData.tags
              ? curatedData.tags
              : []
            )
              .map(
                (t) =>
                  `<span class="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700">${t}</span>`
              )
              .join("")}${topics
      .map(
        (t) =>
          `<span class="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700">${t}</span>`
      )
      .join("")}</div>
          </div>
          <div class="text-right">
            <a class="px-3 py-2 rounded-md border" href="${
              r.html_url
            }" target="_blank">Repository</a>
            ${
              r.homepage
                ? `<a class="ml-2 px-3 py-2 rounded-md border" href="${r.homepage}" target="_blank">Live</a>`
                : ""
            }
          </div>
        </div>
      </div>

      <div class="prose max-w-none dark:prose-invert">${mdHtml}</div>
    `;
  } catch (err) {
    projectDetail.innerHTML = `<div class="text-sm text-rose-600">Could not load project details: ${err.message}</div>`;
  }
}

function closeModal() {
  projectModal.classList.add("hidden");
  projectDetail.innerHTML = "";
  // clear hash if it was a project
  if (location.hash.startsWith("#/project/"))
    history.replaceState(null, "", location.pathname + location.search);
}

modalClose.addEventListener("click", closeModal);
projectModal.addEventListener("click", (e) => {
  if (e.target && e.target.dataset && e.target.dataset.close !== undefined)
    closeModal();
});

// handle deep-linking to open a project if hash is present
function handleHash() {
  const h = location.hash;
  if (h.startsWith("#/project/")) {
    const full = decodeURIComponent(h.replace("#/project/", ""));
    openProject(full);
  } else {
    closeModal();
  }
}
window.addEventListener("hashchange", handleHash);

// Main load
loadBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim() || DEFAULT_USERNAME;
  const token = tokenInput.value.trim();
  if (token) setSessionToken(token);

  ghLink.textContent = username;
  ghLink.href = `https://github.com/${username}`;

  loadBtn.disabled = true;
  loadBtn.textContent = "Loading…";

  try {
    curated = await loadCurated(username); // attempt to load /projects/projects.json
    const fetched = await fetchRepos(username);
    // merge curated metadata where repo name matches
    repos = fetched.map((r) => {
      const name = r.name;
      if (curated && curated[name]) {
        r._curated = curated[name];
        // optionally override description with curated.long or short
        if (curated[name].description)
          r.description = curated[name].description;
      }
      return r;
    });

    buildLangOptions(repos);
    applyFilters();
    // after render, check hash
    handleHash();
  } catch (err) {
    alert("Error loading repos: " + err.message);
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "Load projects";
  }
});

// filters
searchInput.addEventListener("input", applyFilters);
langFilter.addEventListener("change", applyFilters);

// quick auto-load on first visit (comment out if you prefer manual)
document.addEventListener("DOMContentLoaded", () => {
  // if username field is set, auto-load once
  loadBtn.click();
  // open hash if present after load
  setTimeout(handleHash, 800);
});

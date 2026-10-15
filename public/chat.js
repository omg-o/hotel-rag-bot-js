// public/chat.js
//
// LUXE AI — concierge client with sidebar navigation, streaming responses,
// session persistence, and mobile-friendly interactions.

const socket = io();

// ─── Element refs ──────────────────────────────────────────────

const views = {
  home: document.getElementById("view-home"),
  concierge: document.getElementById("view-concierge"),
  guide: document.getElementById("view-guide"),
  dining: document.getElementById("view-dining"),
  spa: document.getElementById("view-spa"),
  requests: document.getElementById("view-requests"),
  local: document.getElementById("view-local"),
  profile: document.getElementById("view-profile"),
  help: document.getElementById("view-help"),
};

const streams = {
  home: document.getElementById("messages-home"),
  concierge: document.getElementById("messages-concierge"),
};

const forms = {
  home: document.getElementById("form-home"),
  concierge: document.getElementById("form-concierge"),
};

const inputs = {
  home: document.getElementById("input-home"),
  concierge: document.getElementById("input-concierge"),
};

const contexts = {
  home: document.getElementById("context-home"),
  concierge: document.getElementById("context-concierge"),
};

const navItems = document.querySelectorAll(".nav-item");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const mobileToggle = document.getElementById("mobile-toggle");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

// ─── State ─────────────────────────────────────────────────────

let currentView = "home";
let currentCategory = "all";
let isWaiting = false;

// ─── Session ID ────────────────────────────────────────────────

let sessionId = localStorage.getItem("chat_session_id");
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem("chat_session_id", sessionId);
}

// ─── Time-of-day greeting ──────────────────────────────────────

(function setGreeting() {
  const el = document.getElementById("greeting-time");
  if (!el) return;
  const h = new Date().getHours();
  let greeting = "Good evening";
  if (h < 12) greeting = "Good morning";
  else if (h < 17) greeting = "Good afternoon";
  el.textContent = greeting;
})();

// ─── Sidebar open/close ────────────────────────────────────────

function openSidebar() {
  sidebar.classList.add("open");
  sidebarBackdrop.classList.add("visible");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.remove("visible");
  document.body.style.overflow = "";
}

mobileToggle?.addEventListener("click", () => {
  if (sidebar.classList.contains("open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarBackdrop?.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sidebar.classList.contains("open")) {
    closeSidebar();
  }
});

// ─── Navigation ────────────────────────────────────────────────

function switchView(name) {
  Object.values(views).forEach((v) => v?.classList.remove("active"));
  views[name]?.classList.add("active");

  navItems.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });

  currentView = name;
  closeSidebar();

  // Focus the composer if entering a chat view
  if (inputs[name]) {
    setTimeout(() => inputs[name].focus(), 150);
  }

  // Scroll main to top on view change
  document.getElementById("main")?.scrollTo({ top: 0, behavior: "smooth" });
}

navItems.forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// Buttons that switch views from inside content (e.g. empty-state action)
document.querySelectorAll("[data-view]").forEach((el) => {
  if (el.classList.contains("nav-item")) return;
  el.addEventListener("click", () => switchView(el.dataset.view));
});

// ─── Category tabs ─────────────────────────────────────────────

document.querySelectorAll("#category-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll("#category-tabs .tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentCategory = tab.dataset.category;

    // Update composer hint
    const hintMap = {
      all: "Searching all hotel knowledge",
      general: "Searching hotel information",
      spa: "Searching spa & wellness",
      dining: "Searching dining",
      events: "Searching events",
    };
    Object.values(contexts).forEach((el) => {
      if (el) el.textContent = hintMap[currentCategory];
    });
  });
});

// ─── Message rendering ─────────────────────────────────────────

function addUserMessage(streamEl, text) {
  const wrap = document.createElement("div");
  wrap.className = "msg user";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  streamEl.appendChild(wrap);
  streamEl.scrollTop = streamEl.scrollHeight;
}

function addBotMessage(streamEl) {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";

  const sig = document.createElement("div");
  sig.className = "msg-sig";
  sig.innerHTML = `<div class="msg-mark">A</div><div class="msg-name">Aurelia</div>`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  wrap.appendChild(sig);
  wrap.appendChild(bubble);
  streamEl.appendChild(wrap);
  streamEl.scrollTop = streamEl.scrollHeight;
  return bubble;
}

function addErrorMessage(streamEl, text) {
  const wrap = document.createElement("div");
  wrap.className = "msg error";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  streamEl.appendChild(wrap);
  streamEl.scrollTop = streamEl.scrollHeight;
}

// ─── Submit handlers ───────────────────────────────────────────

function handleSubmit(viewKey) {
  return (e) => {
    e.preventDefault();
    const inputEl = inputs[viewKey];
    const text = inputEl.value.trim();
    if (!text || isWaiting) return;

    submitMessage(text, viewKey);
    inputEl.value = "";
  };
}

forms.home?.addEventListener("submit", handleSubmit("home"));
forms.concierge?.addEventListener("submit", handleSubmit("concierge"));

// ─── Suggestion buttons ────────────────────────────────────────

document.querySelectorAll(".suggestion").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (isWaiting) return;
    const q = btn.dataset.q;
    if (!q) return;
    submitMessage(q, currentView === "concierge" ? "concierge" : "home");
  });
});

// ─── Guide cards ───────────────────────────────────────────────

document.querySelectorAll(".guide-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (isWaiting) return;
    const q = card.dataset.q;
    if (!q) return;
    // Route guide-card questions through the concierge view
    switchView("concierge");
    setTimeout(() => submitMessage(q, "concierge"), 200);
  });
});

// ─── Submit ────────────────────────────────────────────────────

function submitMessage(text, viewKey) {
  const streamEl = streams[viewKey];
  if (!streamEl) return;

  addUserMessage(streamEl, text);
  isWaiting = true;
  setInputsDisabled(true);

  socket.emit("userMessage", { message: text, category: currentCategory });
}

// ─── Streaming state ───────────────────────────────────────────

const streamingState = {
  home: { bubble: null, buffer: "", timer: null, done: false },
  concierge: { bubble: null, buffer: "", timer: null, done: false },
};

const TYPING_SPEED_MS = 15;

function activeKey() {
  return currentView === "concierge" ? "concierge" : "home";
}

function startTypingLoop(key) {
  const state = streamingState[key];
  if (state.timer) return;

  state.timer = setInterval(() => {
    if (!state.bubble) return;

    if (state.buffer.length > 0) {
      const char = state.buffer[0];
      state.buffer = state.buffer.slice(1);
      state.bubble.textContent += char;

      const streamEl = streams[key];
      if (streamEl) streamEl.scrollTop = streamEl.scrollHeight;
    } else if (state.done) {
      clearInterval(state.timer);
      state.timer = null;
      if (state.bubble) {
        state.bubble.parentElement.classList.remove("typing");
        state.bubble = null;
      }
      isWaiting = false;
      setInputsDisabled(false);

      const inputEl = inputs[key];
      if (inputEl) inputEl.focus();
    }
  }, TYPING_SPEED_MS);
}

function setInputsDisabled(disabled) {
  Object.values(inputs).forEach((el) => {
    if (el) el.disabled = disabled;
  });
  document.querySelectorAll(".composer-send").forEach((btn) => {
    btn.disabled = disabled;
  });
  document.querySelectorAll(".suggestion").forEach((btn) => {
    btn.disabled = disabled;
  });
}

// ─── Socket events ─────────────────────────────────────────────

socket.on("connect", () => {
  statusDot?.classList.remove("offline");
  if (statusText) statusText.textContent = "Online";
  socket.emit("restoreSession", sessionId);
});

socket.on("disconnect", () => {
  statusDot?.classList.add("offline");
  if (statusText) statusText.textContent = "Offline";
});

socket.on("botStart", () => {
  const key = activeKey();
  const streamEl = streams[key];
  if (!streamEl) return;

  const bubble = addBotMessage(streamEl);
  bubble.parentElement.classList.add("typing");

  streamingState[key].bubble = bubble;
  streamingState[key].buffer = "";
  streamingState[key].done = false;
  startTypingLoop(key);
});

socket.on("botChunk", (text) => {
  const key = activeKey();
  const state = streamingState[key];
  if (!state.bubble) {
    const streamEl = streams[key];
    if (!streamEl) return;
    const bubble = addBotMessage(streamEl);
    bubble.parentElement.classList.add("typing");
    state.bubble = bubble;
    state.done = false;
    startTypingLoop(key);
  }
  state.buffer += text;
});

socket.on("botDone", () => {
  const key = activeKey();
  streamingState[key].done = true;
});

socket.on("botError", (text) => {
  const key = activeKey();
  const state = streamingState[key];

  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.buffer = "";
  state.done = false;

  if (state.bubble) {
    state.bubble.parentElement.remove();
    state.bubble = null;
  }

  const streamEl = streams[key];
  if (streamEl) addErrorMessage(streamEl, text);

  isWaiting = false;
  setInputsDisabled(false);
});
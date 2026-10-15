// public/chat.js
//
// Client-side chat logic. Connects to the server via Socket.IO,
// sends user messages, and renders bot responses with a smooth
// character-by-character typing effect (independent of how the
// server batches streaming tokens).

// io() is defined globally by /socket.io/socket.io.js
const socket = io();
// Persistent session ID: survives page refresh, stored in localStorage.
let sessionId = localStorage.getItem("chat_session_id");
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem("chat_session_id", sessionId);
}

// Tell the server our session ID on connect
socket.on("connect", () => {
  console.log("✓ Connected:", socket.id, "| session:", sessionId);
  socket.emit("restoreSession", sessionId);
});

const messages = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");

let isWaiting = false; // prevents double-submits

/**
 * Append a message bubble to the chat.
 * @param {string} text
 * @param {"user"|"bot"|"error"} kind
 * @returns {HTMLElement} the bubble element
 */
function addMessage(text, kind) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${kind}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

function setWaiting(waiting) {
  isWaiting = waiting;
  sendBtn.disabled = waiting;
  input.disabled = waiting;
}

// --- Form submit ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || isWaiting) return;

  addMessage(text, "user");
  input.value = "";
  setWaiting(true);

  // The bot bubble is created by the "botStart" handler below.
  socket.emit("userMessage", text);
});

// --- Streaming protocol with smooth typing effect ---
//
// The LLM may emit large chunks instead of single tokens.
// We buffer incoming text and render it character by character
// at a fixed rate, giving a smooth "typing" experience regardless
// of how the server batches tokens.

let currentBubble = null;   // the bot bubble currently being filled
let pendingText = "";       // buffer of text not yet rendered
let typingTimer = null;     // setInterval id
let streamDone = false;     // has the server finished streaming?

const TYPING_SPEED_MS = 15; // ms per character (~66 chars/sec)

function startTypingLoop() {
  if (typingTimer) return;

  typingTimer = setInterval(() => {
    if (!currentBubble) return;

    if (pendingText.length > 0) {
      // Take one character at a time from the buffer
      const char = pendingText[0];
      pendingText = pendingText.slice(1);
      currentBubble.textContent += char;
      messages.scrollTop = messages.scrollHeight;
    } else if (streamDone) {
      // Buffer is empty and the stream is finished — clean up
      clearInterval(typingTimer);
      typingTimer = null;

      if (currentBubble) {
        currentBubble.parentElement.classList.remove("typing");
        currentBubble = null;
      }
      setWaiting(false);
      input.focus();
    }
  }, TYPING_SPEED_MS);
}

socket.on("botStart", () => {
  console.log("[stream] botStart");
  currentBubble = addMessage("", "bot");
  currentBubble.parentElement.classList.add("typing");

  pendingText = "";
  streamDone = false;
  startTypingLoop();
});

socket.on("botChunk", (text) => {
  console.log("[stream] chunk:", JSON.stringify(text));

  if (!currentBubble) {
    // Safety: chunk arrived before botStart
    currentBubble = addMessage("", "bot");
    currentBubble.parentElement.classList.add("typing");
    startTypingLoop();
  }

  // Just buffer — the typing loop will render it character by character
  pendingText += text;
});

socket.on("botDone", () => {
  console.log("[stream] botDone");
  streamDone = true;
  // The typing loop drains the buffer, then cleans up.
});

socket.on("botError", (text) => {
  console.log("[stream] error:", text);

  if (typingTimer) {
    clearInterval(typingTimer);
    typingTimer = null;
  }
  pendingText = "";
  streamDone = false;

  if (currentBubble) {
    currentBubble.parentElement.remove();
    currentBubble = null;
  }

  addMessage(text, "error");
  setWaiting(false);
  input.focus();
});

// --- Connection status (useful during development) ---
socket.on("connect", () => console.log("✓ Connected:", socket.id));
socket.on("disconnect", () => console.log("✗ Disconnected"));
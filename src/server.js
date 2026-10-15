// src/server.js
//
// Web entry point: serves the chat UI and handles real-time messages
// via Socket.IO. Reuses the RAG core from rag/ingest.js and rag/chain.js.
//
// Session history is persisted in MongoDB, so conversations survive
// page refreshes and server restarts.

import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexDocuments } from "./rag/ingest.js";
import { buildRAGChain } from "./rag/chain.js";
import dotenv from "dotenv";

dotenv.config();

// __dirname doesn't exist in ES modules — this recreates it
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

// Socket.IO with CORS (needed for deployment; harmless locally)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
});

// Serve everything in public/ as static files (HTML, CSS, client JS)
app.use(express.static(join(__dirname, "..", "public")));

// Health check endpoint — used by cloud platforms (Render / Railway / Fly)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// The RAG chain is shared across all users.
// Building it is expensive (embedding the PDF), so we do it ONCE at startup.
let chain;

async function start() {
  console.log("🏨 Starting web server...\n");
  console.log("Indexing knowledge base (this takes ~10 seconds)...");

  const vectorStore = await indexDocuments([
  { path: "./data/hotel_info.pdf", category: "general" },
  { path: "./data/spa_menu.pdf", category: "spa" },
  { path: "./data/restaurant_menu.pdf", category: "dining" },
  { path: "./data/events_schedule.pdf", category: "events" },
]);
  chain = await buildRAGChain(vectorStore);

  console.log("✓ Knowledge base ready\n");

  // --- Socket.IO connection handler ---
  // This runs once for EVERY browser that connects.
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Default session ID = socket.id. The client can overwrite this
    // with a persistent ID via "restoreSession" so history survives
    // page refreshes.
    let sessionId = socket.id;

    // Client tells us its persistent session ID (from localStorage)
    socket.on("restoreSession", (clientSessionId) => {
      sessionId = clientSessionId;
      console.log(`[${socket.id}] Session restored as: ${sessionId}`);
    });

    // Listen for the 'userMessage' event from this specific browser
    socket.on("userMessage", async (data) => {
  // Support both old { message } and new { message, category }
  const message = typeof data === "string" ? data : data.message;
  const category = typeof data === "string" ? "all" : data.category || "all";

  console.log(`[${sessionId}] User (${category}): ${message}`);

  try {
    socket.emit("botStart");
    let fullAnswer = "";

    const stream = await chain.stream({
      input: message,
      sessionId,
      category,
    });

    for await (const chunk of stream) {
      if (chunk.answer) {
        fullAnswer += chunk.answer;
        socket.emit("botChunk", chunk.answer);
      }
    }

    socket.emit("botDone");
    console.log(`[${sessionId}] Bot: ${fullAnswer.slice(0, 60)}...`);
  } catch (error) {
    // error handling unchanged
  }
});

    // Clean up when the browser tab closes
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`✓ Server running at http://localhost:${PORT}\n`);
  });
}

start();
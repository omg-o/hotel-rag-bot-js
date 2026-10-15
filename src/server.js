// src/server.js
//
// Web entry point: serves the chat UI and handles real-time messages
// via Socket.IO. Reuses the RAG core from rag/ingest.js and rag/chain.js.

import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { indexDocuments } from "./rag/ingest.js";
import { buildRAGChain } from "./rag/chain.js";
import dotenv from "dotenv";

dotenv.config();

// __dirname doesn't exist in ES modules — this recreates it
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve everything in public/ as static files (HTML, CSS, client JS)
app.use(express.static(join(__dirname, "..", "public")));

// The RAG chain is shared across all users.
// Building it is expensive (embedding the PDF), so we do it ONCE at startup.
let chain;

async function start() {
  console.log("🏨 Starting web server...\n");
  console.log("Indexing knowledge base (this takes ~10 seconds)...");

  const vectorStore = await indexDocuments(["./data/hotel_info.pdf"]);
  chain = await buildRAGChain(vectorStore);

  console.log("✓ Knowledge base ready\n");

  // --- Socket.IO connection handler ---
  // This runs once for EVERY browser that connects.
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Each user gets their own conversation history.
    // This is why two users don't see each other's messages.
    const chatHistory = [];

    // Listen for the 'userMessage' event from this specific browser
socket.on("userMessage", async (message) => {
  console.log(`[${socket.id}] User: ${message}`);

  try {
    // Signal the client: "bot is about to speak, create an empty bubble"
    socket.emit("botStart");

    // chain.stream() returns an async iterable of chunks.
    // Each chunk from a retrieval chain is { answer, context }.
    // We accumulate `answer` pieces to build the full response.
    let fullAnswer = "";

    const stream = await chain.stream({
      input: message,
      chat_history: chatHistory,
    });

    for await (const chunk of stream) {
      // Not every chunk has an `answer` field — context chunks come first.
      // Skip anything that isn't answer text.
      if (chunk.answer) {
        fullAnswer += chunk.answer;
        socket.emit("botChunk", chunk.answer);
      }
    }

    // Signal completion
    socket.emit("botDone");

    // Update history with the complete exchange
    chatHistory.push(new HumanMessage(message));
    chatHistory.push(new AIMessage(fullAnswer));

    console.log(`[${socket.id}] Bot: ${fullAnswer.slice(0, 60)}...`);
  } catch (error) {
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      socket.emit(
        "botError",
        "I'm receiving too many requests right now. Please wait a moment and try again."
      );
    } else {
      console.error(`[${socket.id}] Error:`, error.message);
      socket.emit("botError", "Something went wrong. Please try again.");
    }
  }
});

    // Clean up when the browser tab closes
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  const PORT = 3000;
  httpServer.listen(PORT, () => {
    console.log(`✓ Server running at http://localhost:${PORT}\n`);
  });
}

start();
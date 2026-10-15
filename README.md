# 🏨 Grand Horizon Hotel — AI Concierge

A production-style conversational AI for a fictional hotel, built with
**LangChain.js** and **Google Gemini**. Answers guest questions grounded
in hotel documents using Retrieval-Augmented Generation (RAG), with a
shared core powering both a **terminal CLI** and a **streaming web app**.

<p align="center">
  <img src="docs/screenshot-web.png" alt="Web UI" width="600">
</p>

## ✨ Features

- **Retrieval-Augmented Generation (RAG)** — answers grounded in hotel PDFs, with strict fallback for out-of-scope questions
- **Token-level streaming** — bot replies type out smoothly, character by character
- **Multi-user web interface** — each browser session gets its own conversation history
- **Shared RAG core** — same ingestion and chain code powers the terminal CLI and the web app
- **Graceful rate-limit handling** — automatic retries with exponential backoff

## 🏗️ Architecture
┌──────────────────────────┐ ┌──────────────────────────────────┐
│ Terminal CLI │ │ Web (Express + Socket.IO) │
│ src/index.js │ │ src/server.js + public/* │
│ (readline) │ │ (streaming, per-session state) │
└────────────┬─────────────┘ └────────────────┬─────────────────┘
│ │
└──────────────┬─────────────────────────┘
▼
┌──────────────────────────────┐
│ RAG Core │
│ src/rag/ingest.js │
│ src/rag/chain.js │
└──────────────┬───────────────┘
▼
┌──────────────────────────────┐
│ LangChain.js + Gemini API │
└──────────────────────────────┘

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ES Modules) |
| LLM | Google Gemini 3.5 Flash-Lite (`@langchain/google`) |
| Embeddings | Gemini `gemini-embedding-001` (`@langchain/google-genai`) |
| RAG framework | LangChain.js (`@langchain/core`, `@langchain/classic`, `@langchain/textsplitters`) |
| PDF parsing | `@langchain/community` + `pdf-parse` |
| Vector store | In-memory (`MemoryVectorStore`) |
| Web server | Express 5 |
| Real-time transport | Socket.IO |
| Config | `dotenv` |

## 🚀 Getting Started

### Prerequisites

- Node.js 20 or higher
- A Google Gemini API key — [get one free](https://aistudio.google.com/apikey)

### Setup

```bash
git clone https://github.com/<your-username>/hotel-rag-bot-js.git
cd hotel-rag-bot-js
npm install
cp .env.example .env        # Windows: copy .env.example .env
# Edit .env and paste your GOOGLE_API_KEY
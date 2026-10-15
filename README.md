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
│ Terminal CLI             │ │ Web (Express + Socket.IO)        │
│ src/index.js             │ │ src/server.js + public/*         │
│ (readline)               │ │ (streaming, per-session state)   │
└────────────┬─────────────┘ └────────────────┬─────────────────┘
             │                                │
     └──────────────┬─────────────────────────┘
▼
┌──────────────────────────────┐
│ RAG Core                     │
│ src/rag/ingest.js            │
│ src/rag/chain.js             │
└──────────────┬───────────────┘
▼
┌──────────────────────────────┐
│ LangChain.js + Gemini API    │
└──────────────────────────────┘

## 🛠️ Tech Stack

| Layer               | Technology |
|---------------------|------------|
| Runtime             | Node.js 20+ (ES Modules) |
| LLM                 | Google Gemini 3.5 Flash-Lite (`@langchain/google`) |
| Embeddings          | Gemini `gemini-embedding-001` (`@langchain/google-genai`) |
| RAG framework       | LangChain.js (`@langchain/core`, `@langchain/classic`, `@langchain/textsplitters`) |
| PDF parsing         | `@langchain/community` + `pdf-parse` |
| Vector store        | In-memory (`MemoryVectorStore`) |
| Web server          | Express 5 |
| Real-time transport | Socket.IO |
| Config              | `dotenv` |

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
# macOS / Linux
cp .env.example .env

# Windows PowerShell
copy .env.example .env
GOOGLE_API_KEY=AIzaSy...your-real-key-here
Run the terminal bot
npm start
Run the Web app
npm run web
hotel-rag-bot-js/
├── data/
│   └── hotel_info.pdf              # Knowledge base (hotel policies, amenities, etc.)
├── public/                         # Static web client
│   ├── index.html                  # Chat UI markup
│   ├── style.css                   # Chat UI styles
│   └── chat.js                     # Socket.IO client + typing effect
├── scripts/                        # Development verification utilities
│   ├── smoke-test.mjs              # Verify all LangChain imports resolve
│   ├── test-ingest.mjs             # Verify PDF → chunks → embeddings
│   └── test-chain.mjs              # Verify retrieval + generation + fallback
├── src/
│   ├── index.js                    # Terminal CLI entry point
│   ├── server.js                   # Web server entry point
│   └── rag/
│       ├── ingest.js               # PDF loading, splitting, embedding, vector store
│       └── chain.js                # Retriever + LLM, exposes invoke() and stream()
├── .env.example                    # Environment template
├── .gitattributes                  # Line-ending policy
├── .gitignore
├── LICENSE
├── README.md
└── package.json
 How It Works
1. Ingestion — src/rag/ingest.js
The pipeline has four stages:

Load — PDFLoader reads hotel_info.pdf and returns one Document per page

Split — RecursiveCharacterTextSplitter breaks pages into ~1000-character chunks with 200-character overlap. Overlap preserves meaning at chunk boundaries (e.g., a sentence split across chunks still appears intact in one of them)

Embed — Each chunk is sent to gemini-embedding-001, which returns a 3072-dimensional vector representing the chunk's semantic meaning

Store — Vectors go into MemoryVectorStore, an in-process store that supports fast cosine-similarity search

2. Retrieval and Generation — src/rag/chain.js
For every user question:

Retrieve — The question is embedded with the same model, and the store returns the top-3 most similar chunks

Format — Chunks are numbered and concatenated into a {context} string

Prompt — The context, conversation history, and user question are assembled into a message array

Generate — Gemini reads the prompt and produces an answer

3. Prompt design — the anti-hallucination trick
The system prompt enforces strict grounding:

Answer the guest's question using ONLY the context provided below.
If the answer is not in the context, say: "I don't have that information. Please contact reception at +91 33 4000 2026."

This is what prevents the bot from inventing a Wi-Fi password or claiming the hotel has a helicopter pad. If retrieval misses, the LLM refuses politely instead of guessing.

4. Streaming protocol
The web UI uses a three-event Socket.IO protocol:

Event	Direction	Purpose
userMessage	Client → Server	User submitted a question
botStart	Server → Client	Create an empty bot bubble with a blinking cursor
botChunk	Server → Client	A piece of the answer text
botDone	Server → Client	Stream complete; re-enable input
botError	Server → Client	Graceful failure message
Client-side smoothing. Gemini sometimes batches tokens into large chunks (e.g., the whole sentence at once). To keep the experience smooth regardless of batching, the client buffers incoming text and renders it character by character every 15ms (≈66 chars/sec). The server is the producer; the render loop is the consumer; the buffer decouples their rates.
Contributing
This is a personal portfolio project, but issues and pull requests are welcome. If you spot a bug or have a suggestion, open an issue.

📄 License
This project is licensed under the MIT License — see LICENSE for details.

👤 Author
omg-o

GitHub: @omg-o

Fourth-year Electrical Engineering student at Jadavpur University, Kolkata.
Interested in backend engineering, applied AI, and building production systems with LLMs.

🙏 Acknowledgements
LangChain.js — RAG orchestration framework

Google Gemini — LLM and embeddings

Socket.IO — real-time transport

Express — HTTP server

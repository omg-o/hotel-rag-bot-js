// src/rag/ingest.js
//
// Purpose: Load PDF documents, split them into chunks, generate embeddings,
// and store those embeddings in a vector store for later retrieval.

import { readFile } from "node:fs/promises";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import dotenv from "dotenv";

dotenv.config();

/**
 * Load one PDF and split it into overlapping chunks.
 *
 * We read the file into a Buffer ourselves and wrap it in a Blob rather
 * than passing the file path string. This avoids a platform-specific
 * bug in LangChain's PDF loader on Linux where the string branch fails
 * and the loader crashes on `.arrayBuffer()` of undefined.
 *
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Array>} Array of Document objects (chunks)
 */
export async function loadAndSplitPDF(filePath) {
  const buffer = await readFile(filePath);
  const blob = new Blob([buffer], { type: "application/pdf" });

  const loader = new PDFLoader(blob, { splitPages: true });
  const pages = await loader.load();
  console.log(`  Loaded ${pages.length} page(s) from ${filePath}`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", " ", ""],
  });

  const chunks = await splitter.splitDocuments(pages);
  console.log(`  Split into ${chunks.length} chunk(s)`);
  return chunks;
}

/**
 * Create a Gemini embeddings client.
 * @returns {GoogleGenerativeAIEmbeddings}
 */
export function createEmbeddings() {
  return new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
  });
}

/**
 * Build an in-memory vector store from document chunks.
 * @param {Array} chunks
 * @returns {Promise<MemoryVectorStore>}
 */
export async function buildVectorStore(chunks) {
  const embeddings = createEmbeddings();
  const store = new MemoryVectorStore(embeddings);
  await store.addDocuments(chunks);
  console.log(`  Stored ${chunks.length} vector(s) in memory`);
  return store;
}

/**
 * Full ingestion pipeline: PDFs -> chunks -> vector store.
 * Each PDF gets tagged with a category in the chunk metadata,
 * so retrieval can be filtered by source.
 *
 * @param {Array<{path: string, category: string}>} pdfConfigs
 * @returns {Promise<MemoryVectorStore>}
 */
export async function indexDocuments(pdfConfigs) {
  console.log("Indexing documents...");
  const allChunks = [];

  for (const { path, category } of pdfConfigs) {
    const chunks = await loadAndSplitPDF(path);

    for (const chunk of chunks) {
      chunk.metadata.category = category;
      chunk.metadata.source = path;
    }

    allChunks.push(...chunks);
  }

  console.log(`  Tagged ${allChunks.length} chunk(s) with categories`);
  return await buildVectorStore(allChunks);
}
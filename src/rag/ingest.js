// src/rag/ingest.js
//
// Purpose: Load PDF documents, split them into chunks, generate embeddings,
// and store those embeddings in a vector store for later retrieval.

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import dotenv from "dotenv";

dotenv.config();

/**
 * Load one PDF and split it into overlapping chunks.
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Array>} Array of Document objects (chunks)
 */
export async function loadAndSplitPDF(filePath) {
  const loader = new PDFLoader(filePath, { splitPages: true });
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
    model: "gemini-embedding-001",  // ← changed from text-embedding-004
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
 * @param {string[]} pdfPaths
 * @returns {Promise<MemoryVectorStore>}
 */
export async function indexDocuments(pdfPaths) {
  console.log("Indexing documents...");
  const allChunks = [];
  for (const path of pdfPaths) {
    const chunks = await loadAndSplitPDF(path);
    allChunks.push(...chunks);
  }
  return await buildVectorStore(allChunks);
}
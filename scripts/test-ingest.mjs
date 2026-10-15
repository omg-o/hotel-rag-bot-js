// test-ingest.mjs
import { indexDocuments } from "../src/rag/ingest.js";

const store = await indexDocuments(["./data/hotel_info.pdf"]);

// Try a few sample queries against the vector store directly
const queries = [
  "What time is check-in?",
  "Are pets allowed?",
  "How much does the Premium King cost?",
  "What attractions are nearby?",
];

for (const q of queries) {
  console.log(`\n=== Query: ${q} ===`);
  const results = await store.similaritySearch(q, 2);
  for (const doc of results) {
    const preview = doc.pageContent.replace(/\s+/g, " ").slice(0, 250);
    console.log("---");
    console.log(preview);
  }
}
// test-chain.mjs
import { indexDocuments } from "../src/rag/ingest.js";
import { buildRAGChain } from "../src/rag/chain.js";

const store = await indexDocuments(["./data/hotel_info.pdf"]);
const chain = await buildRAGChain(store);

const questions = [
  "What time is check-in?",
  "Are pets allowed?",
  "How much does the Premium King cost?",
  "What attractions are nearby?",
  "Do you have a helicopter pad?",
];

// Helper: pause for N milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const q of questions) {
  console.log(`\n=== Q: ${q}`);
  try {
    const result = await chain.invoke({ input: q });
    console.log(`A: ${result.answer}`);
  } catch (err) {
    console.log(`[skipped: ${err.message.slice(0, 80)}...]`);
  }
  // Wait 13 seconds between questions to stay under 5 req/min
  await sleep(13000);
}
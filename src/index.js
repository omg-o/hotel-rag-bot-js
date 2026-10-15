// src/index.js
//
// Entry point: loads the PDF, builds the RAG chain, and starts an
// interactive terminal chat loop.

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { indexDocuments } from "./rag/ingest.js";
import { buildRAGChain } from "./rag/chain.js";
import dotenv from "dotenv";

dotenv.config();

// Small helper to pause execution (used for rate-limit pacing if needed)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("🏨 Grand Horizon Hotel — AI Concierge");
  console.log("─────────────────────────────────────");
  console.log("Loading knowledge base...\n");

  // 1. Index the PDF once at startup
  const vectorStore = await indexDocuments(["./data/hotel_info.pdf"]);

  // 2. Build the RAG chain
  const chain = await buildRAGChain(vectorStore);

  // 3. Set up terminal input
  const rl = readline.createInterface({ input, output });

  // 4. Conversation history — an array of HumanMessage / AIMessage
  const chatHistory = [];

  console.log("\nReady! Ask me anything about the hotel.");
  console.log("Type 'exit' or 'quit' to leave.\n");

  // 5. Chat loop
  while (true) {
    const userInput = (await rl.question("You: ")).trim();

    // Handle exit commands
    if (["exit", "quit", "q"].includes(userInput.toLowerCase())) {
      console.log("\nThank you for staying with us. Goodbye!");
      break;
    }

    // Skip empty input
    if (!userInput) continue;

    try {
      // Invoke the chain with both the current question and past messages
      const response = await chain.invoke({
        input: userInput,
        chat_history: chatHistory,
      });

      console.log(`\nConcierge: ${response.answer}\n`);

      // Append both turns to history for the next iteration
      chatHistory.push(new HumanMessage(userInput));
      chatHistory.push(new AIMessage(response.answer));
    } catch (error) {
      // Handle rate limits gracefully so the loop doesn't crash
      if (error.message?.includes("429") || error.message?.includes("quota")) {
        console.log(
          "\n[Rate limit hit. Free tier allows ~5 requests/min. Waiting 20 seconds...]\n"
        );
        await sleep(20000);
        // Retry once after waiting
        try {
          const retry = await chain.invoke({
            input: userInput,
            chat_history: chatHistory,
          });
          console.log(`\nConcierge: ${retry.answer}\n`);
          chatHistory.push(new HumanMessage(userInput));
          chatHistory.push(new AIMessage(retry.answer));
        } catch (retryErr) {
          console.log(`\n[Still rate-limited: ${retryErr.message.slice(0, 100)}]\n`);
        }
      } else {
        console.error(`\n[Error: ${error.message}]\n`);
      }
    }
  }

  rl.close();
}

main();
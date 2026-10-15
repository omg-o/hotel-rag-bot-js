// src/rag/chain.js
//
// Purpose: Wire together the vector store (retriever) and Gemini (LLM)
// to produce natural-language answers grounded in the retrieved documents,
// with support for multi-turn conversation history.

import { ChatGoogle } from "@langchain/google";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createStuffDocumentsChain } from "@langchain/classic/chains/combine_documents";
import { createRetrievalChain } from "@langchain/classic/chains/retrieval";
import dotenv from "dotenv";

dotenv.config();

export async function buildRAGChain(vectorStore) {
  const llm = new ChatGoogle("gemini-3.5-flash-lite", {
    temperature: 0.3,
    maxRetries: 5,
  });

  // MessagesPlaceholder is a slot that gets filled at runtime with an
  // array of chat messages (the conversation history).
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are a helpful concierge assistant for Grand Horizon Hotel.
Answer the guest's question using ONLY the context provided below.
If the answer is not in the context, say: "I don't have that information. Please contact reception at +91 33 4000 2026."
Be concise and friendly. If prices are mentioned, include the currency (INR).

Context:
{context}`,
    ],
    new MessagesPlaceholder("chat_history"),  // ← history slot
    ["human", "{input}"],
  ]);

  const documentChain = await createStuffDocumentsChain({
    llm,
    prompt,
    outputParser: new StringOutputParser(),
  });

  const retriever = vectorStore.asRetriever({ k: 3 });

  const retrievalChain = await createRetrievalChain({
    retriever,
    combineDocsChain: documentChain,
  });

  return retrievalChain;
} 
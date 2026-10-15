// src/rag/chain.js
//
// Purpose: Wire together the vector store (retriever) and Gemini (LLM)
// to produce grounded answers with streaming support.
//
// Conversation history is persisted in MongoDB, keyed by sessionId.
// This means a page refresh (with the same sessionId) restores context.

import { ChatGoogle } from "@langchain/google";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { MongoDBChatMessageHistory } from "@langchain/mongodb";
import { getChatCollection } from "../db/mongo.js";
import dotenv from "dotenv";

dotenv.config();

function formatDocs(docs) {
  return docs
    .map((doc, i) => {
      const source = doc.metadata.source || "unknown";
      const category = doc.metadata.category || "general";
      return `[Document ${i + 1} | Source: ${source} | Category: ${category}]\n${doc.pageContent}`;
    })
    .join("\n\n---\n\n");
}

export async function buildRAGChain(vectorStore) {
  const llm = new ChatGoogle("gemini-3.5-flash-lite", {
    temperature: 0.3,
    maxRetries: 5,
  });

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
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  function getRetriever(category) {
  const filter =
    category && category !== "all" ? { category } : undefined;
  return vectorStore.asRetriever({ k: 3, filter });
}
  const collection = await getChatCollection();

  // Helper: build a MongoDBChatMessageHistory for a given session
  function historyFor(sessionId) {
    return new MongoDBChatMessageHistory({ collection, sessionId });
  }

  return {
    async invoke({ input, sessionId, category = "all" }) {
  const history = historyFor(sessionId);
  const chatHistory = await history.getMessages();

  const retriever = getRetriever(category);
  const docs = await retriever.invoke(input);
  const messages = await prompt.formatMessages({
    context: formatDocs(docs),
    chat_history: chatHistory,
    input,
  });

  const response = await llm.invoke(messages);
  const answer = response.content;

  await history.addUserMessage(input);
  await history.addAIMessage(answer);

  return { answer, context: docs };
},

    async *stream({ input, sessionId, category = "all" }) {
  const history = historyFor(sessionId);
  const chatHistory = await history.getMessages();

  const retriever = getRetriever(category);
  const docs = await retriever.invoke(input);
  const messages = await prompt.formatMessages({
    context: formatDocs(docs),
    chat_history: chatHistory,
    input,
  });

  const llmStream = await llm.stream(messages);
  let fullAnswer = "";

  for await (const chunk of llmStream) {
    fullAnswer += chunk.content;
    yield { answer: chunk.content };
  }

  await history.addUserMessage(input);
  await history.addAIMessage(fullAnswer);
},
  };
}
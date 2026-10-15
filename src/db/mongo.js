// src/db/mongo.js
//
// MongoDB connection singleton. Reuses the same client across
// all sessions instead of creating a new connection per request.

import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

let client = null;
let collection = null;

export async function getChatCollection() {
  if (collection) return collection;

  client = new MongoClient(process.env.MONGODB_URI, {
    driverInfo: { name: "langchainjs" },
  });
  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  collection = db.collection(process.env.MONGODB_COLLECTION);

  console.log("✓ Connected to MongoDB");
  return collection;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    collection = null;
  }
}
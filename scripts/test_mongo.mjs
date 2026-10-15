import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

console.log("URI present:", !!process.env.MONGODB_URI);
console.log("URI length:", process.env.MONGODB_URI?.length);

try {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  console.log("✓ MongoDB connection successful");
  await client.close();
} catch (err) {
  console.error("✗ MongoDB error:", err.message);
}
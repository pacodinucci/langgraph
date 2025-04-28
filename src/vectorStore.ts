import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

import "dotenv/config";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-ada-002",
});

const pinecone = new Pinecone();
const indexName = process.env.PINECONE_INDEXNAME || "";
const pineconeIndex = pinecone.Index(indexName);

export const vectorStore = new PineconeStore(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});

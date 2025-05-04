import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { vectorStore } from "./vectorStore";

import "dotenv/config";
import { loadAndSplitDocs } from "./loadAndSplit";

export const llm = new ChatOpenAI({
  // model: "gpt-4-0613",
  model: "gpt-4.1-2025-04-14",
  // model: "gpt-3.5-turbo-0125",
  temperature: 0,
});

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
});

// (async () => {
//   const res = await llm.invoke("Hola, quien sos?");
//   console.log(res.content);
// })();

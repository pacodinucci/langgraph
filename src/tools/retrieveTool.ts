import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { vectorStore } from "../vectorStore";

const retrieveSchema = z.object({
  query: z.string(),
});

export const retrieve = tool(
  async ({ query }: { query: string }) => {
    const retrievedDocs = await vectorStore.similaritySearch(query, 2);

    const serialized = retrievedDocs
      .map(
        (doc) =>
          `Source: ${doc.metadata?.source ?? "unknown"}\nContent: ${
            doc.pageContent
          }`
      )
      .join("\n");

    return [serialized, retrievedDocs];
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);

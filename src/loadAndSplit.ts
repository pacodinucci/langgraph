import "dotenv/config";
import cheerio from "cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { vectorStore } from "./vectorStore";

export async function loadAndSplitDocs(vectorStore: any) {
  const pTagSelector = "p";

  const cheerioLoader = new CheerioWebBaseLoader(
    "https://lilianweng.github.io/posts/2023-06-23-agent/",
    {
      selector: pTagSelector,
    }
  );

  const docs = await cheerioLoader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const allSplits = await splitter.splitDocuments(docs);

  await vectorStore.addDocuments(allSplits);

  console.log("Documentos indexados en Pinecone ✔️");
}

loadAndSplitDocs(vectorStore);

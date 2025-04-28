import { StateGraph } from "@langchain/langgraph";
import { toolsCondition } from "@langchain/langgraph/prebuilt";
import { MessagesAnnotation } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";

import { queryOrRespond, tools, generate } from "./nodes";

export const checkpointer = new MemorySaver();

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("queryOrRespond", queryOrRespond)
  .addNode("tools", tools)
  .addNode("generate", generate)
  .addEdge("__start__", "queryOrRespond")
  .addConditionalEdges("queryOrRespond", toolsCondition, {
    __end__: "__end__",
    tools: "tools",
  })
  .addEdge("tools", "generate")
  .addEdge("generate", "__end__")
  .compile({ checkpointer });

import { graph } from "./graph";
import { HumanMessage } from "@langchain/core/messages";

(async () => {
  const result = await graph.invoke({
    messages: [new HumanMessage("What is self-reflection?")],
  });

  console.log("\n🧠 Final response:\n");
  console.log(result.messages.at(-1)?.content);
})();

import { graph } from "./graph";
import { HumanMessage } from "@langchain/core/messages";

(async () => {
  const result = await graph.invoke(
    {
      messages: [new HumanMessage("Hola, soy nuevo")],
    },
    {
      //@ts-ignore
      config: { phone: "5491123456789" },
    }
  );

  console.log("🧠 Mensajes del grafo:");
  for (const msg of result.messages) {
    console.log(msg._getType(), "→", msg.content);
  }
})();

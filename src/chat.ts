import readline from "readline";
import { graph } from "./graph";
import { HumanMessage } from "@langchain/core/messages";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: HumanMessage[] = [];

console.log("🧠 LangGraph Chat (escribí 'exit' para salir)");

function promptUser() {
  rl.question("\n👤 Vos: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    // Guardar mensaje del usuario
    messages.push(new HumanMessage(input));

    try {
      const result = await graph.invoke({ messages });
      const aiResponse = result.messages.at(-1);

      if (aiResponse) {
        console.log(`🤖 Asistente: ${aiResponse.content}`);
        messages.push(aiResponse); // Guardar respuesta del modelo
      }
    } catch (err) {
      console.error("❌ Error al procesar:", err);
    }

    promptUser(); // Seguir preguntando
  });
}

promptUser();

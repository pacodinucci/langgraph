import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { llm } from "./index";
import { retrieve } from "./tools/retrieveTool";
import { createCustomerTool } from "./tools/createCustomerTool";
import { bookAppointmentTool } from "./tools/bookAppointmentTool";
import { interpretDateTool } from "./tools/interpretDateTool";
import { selectTreatmentTool } from "./tools/selectTreatmentTool";

// NODO 1: Decide si responde directamente o llama a un tool
export async function queryOrRespond(
  state: typeof MessagesAnnotation.State & { config?: { phone?: string } }
) {
  const phone =
    (
      state.messages.find((m) => m._getType?.() === "human")
        ?.additional_kwargs as any
    )?.metadata?.phone ?? "desconocido";

  const llmWithTools = llm.bindTools([
    retrieve,
    createCustomerTool,
    bookAppointmentTool,
    interpretDateTool,
    selectTreatmentTool,
  ]);

  const phoneMsg = new SystemMessage(
    `Número del paciente: ${phone}. No debés pedirlo ni inventarlo.`
  );

  // const rulesMsg = new SystemMessage(
  //   `Reglas importantes:
  //   - El número del paciente es ${phone}. No debés pedirlo.
  //   - Si el paciente explícitamente quiere reservar un turno, y no está registrado, pedile nombre y email, y luego usá create_customer.
  //   - Si el paciente ya está registrado y quiere reservar un turno, usá la herramienta book_appointment.
  //   - No uses herramientas si el paciente solo hace preguntas generales.
  //   - No inventes información. Respondé sólo en base al contexto.`
  // );

  const rulesMsg = new SystemMessage(
    `Reglas importantes:
      - El número del paciente es ${phone}. No debés pedirlo.
      - Primero, debes identificar el tratamiento que el paciente quiere reservar.
      - Para identificarlo, usá la herramienta select_treatment.
      - Solo después de tener el tratamiento, si el paciente menciona una fecha de forma natural (como "mañana", "el próximo jueves", etc.), usá la herramienta interpret_date para convertirlo a una fecha concreta.
      - Si el paciente solo realiza consultas generales (sobre servicios, precios, tratamientos, horarios, etc.), no debes registrar nada ni usar herramientas de reserva.
      - Si el paciente quiere reservar y no está registrado, pedile nombre y correo electrónico, y usá create_customer.
      - No inventes información ni completes datos que no fueron pedidos.
      - Respondé siempre en base al contexto disponible.`
  );

  const inputMessages = [phoneMsg, rulesMsg, ...state.messages];

  const response = await llmWithTools.invoke(inputMessages);
  console.log("🧠 Respuesta del modelo:", JSON.stringify(response, null, 2));

  return { messages: [response] };
}

// NODO 2: Ejecuta las tools
export const tools = new ToolNode([
  retrieve,
  createCustomerTool,
  bookAppointmentTool,
  interpretDateTool,
  selectTreatmentTool,
]);

// NODO 3: Genera respuesta final usando los ToolMessages
export async function generate(
  state: typeof MessagesAnnotation.State & { config?: { phone?: string } }
) {
  const recentToolMessages: ToolMessage[] = [];

  for (let i = state.messages.length - 1; i >= 0; i--) {
    const message = state.messages[i];
    if (message instanceof ToolMessage) {
      recentToolMessages.push(message);
    } else {
      break;
    }
  }

  const toolMessages = recentToolMessages.reverse();
  const docsContent = toolMessages.map((msg) => msg.content).join("\n");

  const phone =
    (state.messages[0].additional_kwargs as any)?.metadata?.phone ??
    "desconocido";

  const systemMessageContent =
    "Eres una asistente llamada Daiana. Tenes que responder en base al contexto, no inventes." +
    `El número de teléfono del paciente es ${phone}. No debés pedirlo.` +
    "Si el paciente pide reservar turno, y no está registrado, pedile nombre y email y usá create_customer. " +
    "Si el paciente ya está registrado y pide turno, usá book_appointment. " +
    "No inventes información. Respondé sólo en base a las herramientas." +
    "\n\n" +
    docsContent;

  const conversationMessages = state.messages.filter(
    (msg) =>
      msg instanceof HumanMessage ||
      (msg instanceof AIMessage && msg.tool_calls?.length === 0)
  );

  const prompt = [
    new SystemMessage(systemMessageContent),
    ...conversationMessages,
  ];

  const response = await llm.invoke(prompt);
  return { messages: [response] };
}

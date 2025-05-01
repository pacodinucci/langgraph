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

  const rulesMsg = new SystemMessage(
    `Reglas importantes:
      - El número del paciente es ${phone}. No debés pedirlo.
      - Si el paciente hace preguntas generales sobre información de la empresa, tratamientos, precios, servicios o tecnología, usá retrieve.
      - Primero, debes identificar el tratamiento que el paciente quiere reservar.
      - Para identificarlo, usá la herramienta select_treatment.
      - Solo después de tener el tratamiento, si el paciente menciona una fecha de forma natural (como "mañana", "el próximo jueves", etc.), usá la herramienta interpret_date para convertirlo a una fecha concreta.
      - Si el paciente solo realiza consultas generales (sobre servicios, precios, tratamientos, horarios, etc.), no debes registrar nada ni usar herramientas de reserva.
      - Si el paciente quiere reservar y no está registrado, pedile nombre y correo electrónico, y usá create_customer.
      - No inventes información ni completes datos que no fueron pedidos.
      - Respondé siempre en base al contexto disponible.
      - No inventes pasos. Respondé en base estricta al contexto y herramientas.`
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

  const toolMessages = recentToolMessages
    .reverse()
    .filter((msg) => {
      if (typeof msg.content === "string") {
        return !msg.content.toLowerCase().includes("ya está registrado");
      }
      return true;
    })
    .map((msg) => (typeof msg.content === "string" ? msg.content : ""))
    .join("\n");

  const phone =
    (state.messages[0].additional_kwargs as any)?.metadata?.phone ??
    "desconocido";

  const systemMessageContent =
    "Eres una asistente llamada Daiana. Tenes que responder en base al contexto, no inventes." +
    `El número de teléfono del paciente es ${phone}. No debés pedirlo.` +
    // "Si el paciente pide reservar turno, y no está registrado, pedile nombre y email y usá create_customer. " +
    "Si el paciente hace preguntas generales sobre información de la empresa, tratamientos, precios, servicios o tecnología, usá retrieve." +
    "No respondas directamente, solo con herramientas." +
    `Siempre que el paciente quiera reservar, verificá silenciosamente si ya está registrado usando el número ${phone} con la herramienta create_customer. No le digas que vas a hacer esta verificación.` +
    "Si ya está registrado, continuá con la reserva sin pedirle nombre ni correo y sin mencionar que ya está registrado." +
    "Si no está registrado, pedile su nombre y correo, y luego llamá a create_customer para registrarlo." +
    // "Si el paciente ya está registrado y pide turno, usá book_appointment." +
    "Si ya tenés el tratamiento, la fecha, la hora y el número del paciente, usá directamente la herramienta book_appointment sin pedir confirmación al paciente ni explicar lo que estás haciendo." +
    "No tenés que verificar la disponibilidad de turnos hasta que no tengas fecha y hora." +
    "Una vez que estas usando book_appointment no pidas email y nombre, ya los tenés a disposición." +
    "No inventes información. Respondé sólo en base a las herramientas." +
    "\n\n" +
    toolMessages;

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

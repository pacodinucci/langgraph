import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { llm } from "./llm";
import { retrieve } from "./tools/retrieveTool";
import { createCustomerTool } from "./tools/createCustomerTool";
import { bookAppointmentTool } from "./tools/bookAppointmentTool";
import { interpretDateTool } from "./tools/interpretDateTool";
import { selectTreatmentTool } from "./tools/selectTreatmentTool";
import { getUpcomingAppointmentTool } from "./tools/getUpcomingAppointment";
import { rescheduleAppointmentTool } from "./tools/rescheduleAppointmentTool";
import { identifyAppointmentToRescheduleTool } from "./tools/identifyAppointmentToRescheduleTool";
import { cancelAppointmentTool } from "./tools/cancelAppointmentTool";

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
    identifyAppointmentToRescheduleTool,
    rescheduleAppointmentTool,
    cancelAppointmentTool,
  ]);

  const phoneMsg = new SystemMessage(
    `Número del paciente: ${phone}. No debés pedirlo ni inventarlo.`
  );

  const rulesMsg = new SystemMessage(
    `Reglas importantes:
    - El número del paciente es ${phone}. No debés pedirlo.
    - Si el paciente hace preguntas generales sobre la empresa, tratamientos, precios, servicios o tecnología, usá retrieve.
    - Para nuevas reservas, primero identificá el tratamiento con select_treatment.
    - Si se menciona una fecha como "mañana", "jueves", etc., usá interpret_date.
    - Si el paciente quiere reservar y no está registrado, pedile nombre y email, y usá create_customer.
    - Si el paciente quiere cambiar, mover, reprogramar o modificar un turno:
      • Primero, usá identify_appointment_to_reschedule para identificar cuál turno quiere modificar.
      • Luego, preguntá por la nueva fecha y la nueva hora.
      • No llames a reschedule_appointment hasta tener la nueva fecha **y una hora explícita en formato HH:mm (por ejemplo, "10:30")**.
      • Si el paciente dice "la misma hora", "igual que antes", u otra frase ambigua, pedile que indique la hora exacta.
      • Solo llamá a reschedule_appointment cuando tengas fecha y hora clara y correcta.
    - Si el paciente quiere cancelar un turno:
      • Primero, usá identify_appointment_to_reschedule para identificar cuál turno quiere cancelar.
      • Luego, usá cancel_appointment para cancelarlo definitivamente.
    - No respondas con la llamada a identify_appointment_to_reschedule. Solo llamala y esperá la respuesta.
    - Nunca uses book_appointment para modificar o cancelar un turno existente.
    - No inventes información ni pasos. Respondé en base a las herramientas disponibles.`
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
  identifyAppointmentToRescheduleTool,
  rescheduleAppointmentTool,
  cancelAppointmentTool,
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
    "Eres una asistente llamada Daiana. Respondé solo en base al contexto, sin inventar ni asumir." +
    `El número del paciente es ${phone}. No debés pedirlo.` +
    "Si el paciente pregunta sobre la empresa o servicios, usá retrieve." +
    "Para nuevas reservas, identificá el tratamiento, luego la fecha (con interpret_date si es necesario) y usá book_appointment." +
    "Si quiere cambiar un turno, primero identificá el turno con identify_appointment_to_reschedule." +
    "Cuando el paciente te dé una nueva fecha y hora, recién ahí usá reschedule_appointment." +
    "No uses reschedule_appointment si no tenés la nueva fecha y hora." +
    "Si el paciente quiere cancelar un turno, primero usá identify_appointment_to_reschedule para saber cuál quiere cancelar y luego cancel_appointment." +
    "No respondas con la llamada a identify_appointment_to_reschedule. Solo llamala y esperá la respuesta." +
    "No uses book_appointment para turnos que ya existen." +
    `Verificá si el paciente está registrado usando create_customer de forma silenciosa con el número.` +
    "No pidas ni nombre ni email si el paciente ya está registrado." +
    "Respondé solo con herramientas. No inventes pasos." +
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

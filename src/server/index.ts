import express, { Request, Response } from "express";
import cors from "cors";
import { graph, checkpointer } from "../graph";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import db from "../../lib/db";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// En memoria: historial de conversación por sesión
const conversations: Record<string, (HumanMessage | AIMessage)[]> = {};

app.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const { number, messages } = req.body;

  if (!number || !messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const sessionId = number;
  const lastUserMessage = messages.at(-1)?.content;

  if (!lastUserMessage) {
    res.status(400).json({ error: "Missing user message content" });
    return;
  }

  // Buscar si el usuario ya existe en la base
  const existingCustomer = await db.customer.findFirst({
    where: { phone: sessionId },
  });

  const firstName = existingCustomer?.name?.split(" ")[0] ?? null;

  const registrationStatusMessage = new SystemMessage(
    firstName
      ? `INSTRUCCIONES IMPORTANTES:
      - El paciente ya está registrado.
      - Su primer nombre es ${firstName}.
      - Su correo electrónico es ${existingCustomer?.email}.
      - No debes pedirle nuevamente su nombre ni su correo electrónico. Ya los conocés.
      - Comenzá directamente preguntando qué tratamiento desea reservar o ayudándolo en lo que necesite.`
      : `INSTRUCCIONES IMPORTANTES:
      - El paciente no está registrado.
      - Antes de continuar, pedile su nombre completo y su correo electrónico para poder registrarlo.`
  );

  const phoneMessage = new SystemMessage(
    `Número de teléfono del paciente: ${sessionId}. No debés pedirlo. Usalo directamente cuando sea necesario.`
  );

  // Verificación de próximos turnos
  let upcomingAppointmentMessage: SystemMessage | null = null;

  if (existingCustomer) {
    const now = new Date();

    const upcoming = await db.appointment.findFirst({
      where: {
        customerId: existingCustomer.id,
        date: {
          gte: now,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    if (upcoming) {
      const dateStr = upcoming.date.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const hour = upcoming.hour;
      const treatment = upcoming.treatment;

      upcomingAppointmentMessage = new SystemMessage(
        `INFORMACIÓN ADICIONAL:
      - El paciente tiene un turno reservado para el ${dateStr} a las ${hour} hs para un tratamiento de ${treatment}.
      - Si el paciente dice "hola", mencioná el turno como parte del saludo y preguntá si desea modificarlo o consultar algo más.
      - Si el paciente pregunta por su turno, respondé con esta información directamente.`
      );
    }
  }
  // ------ //

  // Inicializar historial si no existe
  if (!conversations[sessionId]) {
    conversations[sessionId] = [];
  }

  const userMessage = new HumanMessage({
    content: lastUserMessage,
    additional_kwargs: {
      metadata: {
        phone: sessionId,
      },
    },
  });

  conversations[sessionId].push(userMessage);

  try {
    const result = await graph.invoke(
      {
        messages: [
          phoneMessage,
          registrationStatusMessage,
          ...(upcomingAppointmentMessage ? [upcomingAppointmentMessage] : []),
          ...conversations[sessionId],
        ],
      },
      {
        configurable: {
          thread_id: sessionId,
        },
      } as any
    );

    const aiResponse = result.messages.at(-1);
    if (aiResponse) {
      conversations[sessionId].push(aiResponse);
      res.json({ message: aiResponse.content });
    } else {
      res.status(500).json({ error: "No AI response" });
    }
  } catch (err) {
    console.error("❌ Graph error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 LangGraph server listening on http://localhost:${PORT}`);
});

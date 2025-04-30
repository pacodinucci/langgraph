import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 🔥 Fecha actual del sistema (definila bien según zona horaria)
const today = new Date();

export const interpretDateTool = tool(
  async ({ userExpression }) => {
    console.log("🧠 Interpretando fecha:", userExpression);

    const formattedToday = today.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Capitalizar primera letra del día (opcional)
    const capitalized =
      formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1);

    return `Hoy es ${capitalized}. El usuario dijo: "${userExpression}". Calculá la fecha real basada en hoy.`;
  },
  {
    name: "interpret_date",
    description:
      "Interpreta una fecha natural como 'mañana' o 'el próximo jueves' basado en la fecha actual.",
    schema: z.object({
      userExpression: z
        .string()
        .describe(
          'Expresión de fecha como "mañana", "el martes", "7 de mayo", etc.'
        ),
    }),
  }
);

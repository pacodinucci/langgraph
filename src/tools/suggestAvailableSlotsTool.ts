import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";
import { CLINIC_OPEN_HOUR, CLINIC_CLOSE_HOUR } from "../../lib/constants";

const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let h = CLINIC_OPEN_HOUR; h < CLINIC_CLOSE_HOUR; h++) {
    for (let m = 0; m < 60; m += 15) {
      slots.push(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      );
    }
  }
  return slots;
};

function getNextNDays(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

export const suggestAvailableSlotsTool = tool(
  async ({ phone, specificDay, specificHour, durationModules = 2 }) => {
    const customer = await db.customer.findFirst({ where: { phone } });
    if (!customer) return "No encontré el paciente en la base de datos.";

    const suggestions: { date: string; hour: string }[] = [];

    if (specificDay) {
      const date = new Date(specificDay);
      const slots = generateTimeSlots();

      for (let i = 0; i < slots.length; i++) {
        const candidateBlock = slots.slice(i, i + durationModules);

        // Si el bloque está incompleto (por ejemplo, solo un módulo al final del día), lo ignoramos
        if (candidateBlock.length < durationModules) continue;

        const occupied = await db.calendar.findMany({
          where: {
            date,
            hour: { in: candidateBlock },
            status: "reserved",
          },
        });

        // Si alguno de los slots está ocupado, no es válido
        if (occupied.length === 0) {
          suggestions.push({
            date: date.toISOString().split("T")[0],
            hour: candidateBlock[0],
          });
        }
      }

      if (suggestions.length === 0) return "No hay turnos disponibles ese día.";

      return `Horarios disponibles el ${specificDay}:
${suggestions.map((s) => `- ${s.hour}`).join("\n")}`;
    }

    if (specificHour) {
      const [h, m] = specificHour.split(":").map(Number);
      const weekStart = new Date();
      const weekEnd = new Date();
      weekEnd.setDate(weekStart.getDate() + 13);

      const days = getNextNDays(weekStart, weekEnd);

      for (const date of days) {
        const candidateBlock = [];
        for (let i = 0; i < durationModules; i++) {
          const time = new Date(date);
          time.setHours(h, m + i * 15, 0, 0);
          const formatted = time.toTimeString().slice(0, 5);
          candidateBlock.push(formatted);
        }

        const occupied = await db.calendar.findMany({
          where: {
            date,
            hour: { in: candidateBlock },
            status: "reserved",
          },
        });

        if (occupied.length === 0) {
          suggestions.push({
            date: date.toISOString().split("T")[0],
            hour: candidateBlock[0],
          });
        }
      }

      if (suggestions.length === 0)
        return "No encontré turnos libres a esa hora en estas dos semanas.";

      return `Días disponibles a las ${specificHour}:
${suggestions.map((s) => `- ${s.date}`).join("\n")}`;
    }

    return "Por favor, indicá un día específico o un horario exacto para buscar disponibilidad.";
  },
  {
    name: "suggest_available_slots",
    description:
      "Sugiere horarios disponibles para un tratamiento según día o horario específico.",
    schema: z.object({
      phone: z.string().describe("Número de teléfono del paciente."),
      specificDay: z
        .string()
        .optional()
        .describe("Día específico a consultar (YYYY-MM-DD)."),
      specificHour: z
        .string()
        .optional()
        .describe("Hora específica a consultar (HH:mm)."),
      durationModules: z
        .number()
        .optional()
        .describe(
          "Cantidad de módulos de 15 minutos que requiere el tratamiento."
        ),
    }),
  }
);

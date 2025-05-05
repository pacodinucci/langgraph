import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";

const timeRanges = {
  manana: ["08:00", "12:00"],
  tarde: ["12:00", "18:00"],
  noche: ["18:00", "21:00"],
};

export const suggestAvailableSlotsTool = tool(
  async ({ phone, dateRange, preferredDays, preferredTimeOfDay }) => {
    const customer = await db.customer.findFirst({ where: { phone } });
    if (!customer) return "No encontré el paciente en la base de datos.";

    const today = new Date();
    const fromDate = dateRange?.from ? new Date(dateRange.from) : today;
    const toDate = dateRange?.to
      ? new Date(dateRange.to)
      : new Date(today.getTime() + 7 * 86400 * 1000);

    const suggestions: { date: string; hour: string }[] = [];

    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const dayName = d.toLocaleDateString("es-AR", { weekday: "long" });
      if (preferredDays && !preferredDays.includes(dayName)) continue;

      const [fromHour, toHour] = timeRanges[preferredTimeOfDay || "manana"];
      const [fromH, fromM] = fromHour.split(":").map(Number);
      const [toH, toM] = toHour.split(":").map(Number);

      for (let h = fromH; h < toH; h++) {
        for (let m = 0; m < 60; m += 15) {
          const hour = `${h.toString().padStart(2, "0")}:${m
            .toString()
            .padStart(2, "0")}`;

          const overlapping = await db.appointment.findFirst({
            where: {
              date: d,
              hour,
              isCanceled: false,
            },
          });

          if (!overlapping) {
            suggestions.push({
              date: d.toISOString().split("T")[0],
              hour,
            });
            if (suggestions.length >= 3) break;
          }
        }
        if (suggestions.length >= 3) break;
      }
      if (suggestions.length >= 3) break;
    }

    if (suggestions.length === 0) {
      return "No encontré horarios disponibles según tus preferencias.";
    }

    return `Encontré estos horarios disponibles:\n${suggestions
      .map((s) => `- ${s.date} a las ${s.hour}`)
      .join("\n")}`;
  },
  {
    name: "suggest_available_slots",
    description:
      "Sugiere horarios disponibles para un turno basándose en las preferencias del paciente.",
    schema: z.object({
      phone: z.string().describe("Número de teléfono del paciente."),
      dateRange: z
        .object({
          from: z.string().describe("Fecha inicial del rango (YYYY-MM-DD)."),
          to: z.string().describe("Fecha final del rango (YYYY-MM-DD)."),
        })
        .optional(),
      preferredDays: z
        .array(z.string())
        .optional()
        .describe("Días preferidos (ej: lunes, miércoles)."),
      preferredTimeOfDay: z
        .enum(["manana", "tarde", "noche"])
        .optional()
        .describe("Franja horaria preferida."),
    }),
  }
);

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";
import { parseSpanishDate } from "../../lib/parseDate";

export const cancelAppointmentTool = tool(
  async ({ phone, date, hour }) => {
    const customer = await db.customer.findFirst({ where: { phone } });
    if (!customer) {
      return "No encontré al paciente en la base de datos.";
    }

    const parsedDate = parseSpanishDate(date);
    if (!parsedDate) {
      return `No pude interpretar la fecha "${date}". ¿Podrías reformularla?`;
    }

    const appointment = await db.appointment.findFirst({
      where: {
        customerId: customer.id,
        date: parsedDate,
        hour,
        isCanceled: false,
      },
    });

    if (!appointment) {
      return "No encontré un turno activo con esa fecha y hora.";
    }

    // 1️⃣ Cancelar turno (borrado lógico)
    await db.appointment.update({
      where: { id: appointment.id },
      data: { isCanceled: true },
    });

    // 2️⃣ Eliminar bloques del calendario
    await db.calendar.deleteMany({
      where: { appointmentId: appointment.id },
    });

    return `Tu turno del ${parsedDate.toLocaleDateString(
      "es-AR"
    )} a las ${hour} hs fue cancelado correctamente.`;
  },
  {
    name: "cancel_appointment",
    description: "Cancela un turno programado del paciente.",
    schema: z.object({
      phone: z.string().describe("Número de teléfono del paciente."),
      date: z
        .string()
        .describe("Fecha del turno a cancelar (ej: '8 de mayo')."),
      hour: z
        .string()
        .describe("Hora del turno a cancelar (formato HH:mm en 24 hs)."),
    }),
  }
);

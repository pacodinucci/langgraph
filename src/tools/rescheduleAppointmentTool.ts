// tools/rescheduleAppointmentTool.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";
import { parseSpanishDate } from "../../lib/parseDate";

export const rescheduleAppointmentTool = tool(
  async ({ appointmentId, newDate, newHour }) => {
    const appointment = await db.appointment.findUnique({
      where: { id: appointmentId },
      include: { Customer: true },
    });

    if (!appointment) {
      return "No encontré el turno que querés modificar.";
    }

    const parsedDate = parseSpanishDate(newDate);
    if (!parsedDate) {
      return `No pude interpretar la fecha "${newDate}". ¿Podrías reformularla?`;
    }

    const [hourH, hourM] = newHour.split(":").map(Number);
    const newStart = new Date(parsedDate);
    newStart.setHours(hourH, hourM, 0, 0);

    const newEnd = new Date(newStart.getTime() + appointment.duration * 60_000);

    // Verificar solapamientos (excluyendo el turno actual)
    const conflicts = await db.appointment.findMany({
      where: {
        id: { not: appointment.id },
        date: parsedDate,
        hour: {
          lte: newEnd.toTimeString().slice(0, 5),
        },
      },
    });

    const overlap = conflicts.some((appt) => {
      const [h, m] = appt.hour.split(":").map(Number);
      const start = new Date(parsedDate);
      start.setHours(h, m, 0, 0);
      const end = new Date(start.getTime() + appt.duration * 60_000);
      return newStart < end && start < newEnd;
    });

    if (overlap) {
      return `El horario ${newHour} ya está ocupado. Por favor elegí otro.`;
    }

    // 1️⃣ Eliminar bloques previos del calendario
    await db.calendar.deleteMany({ where: { appointmentId: appointment.id } });

    // 2️⃣ Actualizar el turno
    await db.appointment.update({
      where: { id: appointment.id },
      data: {
        date: parsedDate,
        hour: newHour,
      },
    });

    // 3️⃣ Crear nuevos bloques de calendario
    const modules = appointment.duration / 15;
    for (let i = 0; i < modules; i++) {
      const blockStart = new Date(newStart.getTime() + i * 15 * 60_000);
      const blockHour = blockStart.toTimeString().slice(0, 5);

      await db.calendar.create({
        data: {
          date: parsedDate,
          hour: blockHour,
          treatment: appointment.treatment,
          status: "reserved",
          appointmentId: appointment.id,
          customerId: appointment.customerId!,
        },
      });
    }

    return `Tu turno fue reprogramado exitosamente para el ${parsedDate.toLocaleDateString(
      "es-AR",
      {
        timeZone: "America/Argentina/Buenos_Aires",
      }
    )} a las ${newHour} hs.`;
  },
  {
    name: "reschedule_appointment",
    description:
      "Reprograma un turno específico ya identificado, utilizando su ID.",
    schema: z.object({
      appointmentId: z
        .string()
        .describe("ID del turno que se desea modificar."),
      newDate: z
        .string()
        .describe("Nueva fecha para el turno (por ejemplo: '10 de mayo')."),
      newHour: z
        .string()
        .describe("Nueva hora para el turno (formato HH:mm en 24 hs)."),
    }),
  }
);

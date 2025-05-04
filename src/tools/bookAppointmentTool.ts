import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";
import { parseSpanishDate } from "../../lib/parseDate";

// 🔥 Mapeo de tratamientos a cantidad de módulos de 15 minutos
const treatmentDurations: Record<string, number> = {
  "Depilación Láser": 2, // 30 minutos
  "Tratamiento Facial": 4, // 60 minutos
  // Puedes agregar más tratamientos acá
};

export const bookAppointmentTool = tool(
  async ({ treatment, zones, date, hour, phone }) => {
    console.log("🛠️ Intentando reservar turno para", phone);
    console.log("Data Recibida --> ", { treatment, zones, date, hour, phone });

    const customer = await db.customer.findFirst({ where: { phone } });
    if (!customer) {
      return "El paciente no está registrado en la base de datos.";
    }

    zones = zones ?? [];

    const modules = treatmentDurations[treatment];
    if (!modules) {
      return `No tengo registrada la duración para el tratamiento "${treatment}".`;
    }

    const parsedDate = parseSpanishDate(date);
    if (!parsedDate) {
      console.log("No se pudo parsear la fecha.");
      return "No pude entender la fecha que me diste. ¿Podrías reformularla?";
    }

    const [startHour, startMinutes] = hour.split(":").map(Number);
    const appointmentStart = new Date(parsedDate);
    appointmentStart.setHours(startHour, startMinutes, 0, 0);

    const durationMinutes = modules * 15;
    const appointmentEnd = new Date(
      appointmentStart.getTime() + durationMinutes * 60_000
    );

    // Buscar solapamientos
    const existingAppointments = await db.appointment.findMany({
      where: {
        date: parsedDate,
        isCanceled: false,
        hour: {
          lte: appointmentEnd.toTimeString().slice(0, 5),
        },
      },
    });

    const overlap = existingAppointments.some((appt) => {
      const [apptHour, apptMinutes] = appt.hour.split(":").map(Number);
      const apptStart = new Date(parsedDate);
      apptStart.setHours(apptHour, apptMinutes, 0, 0);

      const apptEnd = new Date(apptStart.getTime() + appt.duration * 60_000);

      return appointmentStart < apptEnd && apptStart < appointmentEnd;
    });

    if (overlap) {
      return `El horario ${hour} ya está ocupado. Por favor elegí otro.`;
    }

    // ✅ Crear appointment
    const appointment = await db.appointment.create({
      data: {
        treatment,
        zones,
        date: parsedDate,
        hour,
        duration: durationMinutes,
        customerId: customer.id,
      },
    });

    // ✅ Crear módulos de calendario
    for (let i = 0; i < modules; i++) {
      const blockStart = new Date(appointmentStart.getTime() + i * 15 * 60_000);
      const blockHour = blockStart.toTimeString().slice(0, 5); // HH:mm

      await db.calendar.create({
        data: {
          date: parsedDate,
          hour: blockHour,
          treatment,
          status: "reserved",
          appointmentId: appointment.id,
          // professionalId,
          customerId: customer.id,
        },
      });
    }

    console.log("Turno y calendario creados correctamente.");

    return `Turno reservado exitosamente para ${
      customer.name
    } el ${parsedDate.toLocaleDateString()} a las ${hour} hs.`;
  },
  {
    name: "book_appointment",
    description: "Reserva un turno para un tratamiento en la clínica.",
    schema: z.object({
      treatment: z
        .string()
        .describe("Nombre del tratamiento que el paciente quiere reservar."),
      zones: z
        .array(z.string())
        .optional()
        .describe("Zonas que quiere tratar (si aplica)."),
      date: z
        .string()
        .describe('Fecha deseada para el turno (por ejemplo "7 de mayo").'),
      hour: z
        .string()
        .describe("Hora deseada para el turno (formato HH:mm en 24 hs)."),
      phone: z
        .string()
        .describe(
          "Número de teléfono del paciente, usado para vincular el turno."
        ),
    }),
  }
);

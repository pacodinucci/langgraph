import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";
import { parseSpanishDate } from "../../lib/parseDate";

export const identifyAppointmentToRescheduleTool = tool(
  async ({ phone, treatment, date }) => {
    const customer = await db.customer.findFirst({ where: { phone } });
    if (!customer) {
      return "No encontré al paciente en la base de datos.";
    }

    const now = new Date();
    const where: any = {
      customerId: customer.id,
      isCanceled: false,
      date: { gte: now },
    };

    if (treatment) {
      where.treatment = treatment;
    }

    if (date) {
      const parsedDate = parseSpanishDate(date);
      if (parsedDate) {
        const utcDate = new Date(
          Date.UTC(
            parsedDate.getFullYear(),
            parsedDate.getMonth(),
            parsedDate.getDate()
          )
        );
        where.date = {
          gte: utcDate,
          lt: new Date(
            Date.UTC(
              parsedDate.getFullYear(),
              parsedDate.getMonth(),
              parsedDate.getDate() + 1
            )
          ),
        };
      }
    }

    console.log("WHERE --> ", where);

    const matchingAppointments = await db.appointment.findMany({
      where,
      orderBy: { date: "asc" },
    });

    if (matchingAppointments.length === 0) {
      return "No encontré ningún turno futuro que coincida con los criterios.";
    }

    if (matchingAppointments.length > 1) {
      return `Hay más de un turno programado${
        treatment ? " para ese tratamiento" : ""
      }. Por favor especificá mejor cuál querés modificar.`;
    }

    const match = matchingAppointments[0];
    return `Identifiqué el turno a modificar. ID del turno: ${match.id}`;
  },
  {
    name: "identify_appointment_to_reschedule",
    description:
      "Identifica cuál es el turno futuro que el paciente desea modificar. Se basa en el número de teléfono y, opcionalmente, en el tratamiento y fecha.",
    schema: z.object({
      phone: z
        .string()
        .describe("Número de teléfono del paciente, para buscar sus turnos."),
      treatment: z
        .string()
        .optional()
        .describe("Tratamiento que desea modificar, si fue especificado."),
      date: z
        .string()
        .optional()
        .describe("Fecha del turno a modificar (ejemplo: '8 de mayo')."),
    }),
  }
);

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";

export const getUpcomingAppointmentTool = tool(
  async ({ phone }: { phone: string }) => {
    const customer = await db.customer.findFirst({
      where: { phone },
    });

    if (!customer) {
      return "No encontré ningún paciente con ese número.";
    }

    const today = new Date();

    const upcoming = await db.appointment.findFirst({
      where: {
        customerId: customer.id,
        date: {
          gte: today,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    if (!upcoming) {
      return "No tenés turnos próximos.";
    }

    return `Tu próximo turno es el ${upcoming.date.toLocaleDateString(
      "es-AR"
    )} a las ${upcoming.hour} hs para ${upcoming.treatment}`;
  },
  {
    name: "get_upcoming_appointments",
    description: "Devuelve el próximo turno reservado por el paciente.",
    schema: z.object({
      phone: z.string().describe("Número de teléfono del paciente."),
    }),
  }
);

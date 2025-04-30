import { tool } from "@langchain/core/tools";
import db from "../../lib/db"; // O donde tengas tu instancia de Prisma
import { z } from "zod";

export const createCustomerTool = tool(
  async ({
    phone,
    name,
    email,
  }: {
    phone: string;
    name: string;
    email: string;
  }) => {
    // Buscar si ya existe
    const existing = await db.customer.findFirst({ where: { phone } });

    if (existing) {
      return `El usuario ya está registrado. No es necesario crear uno nuevo.`;
    }

    // Crear nuevo paciente
    const newCustomer = await db.customer.create({
      data: {
        phone,
        name,
        email,
      },
    });

    return `Paciente ${newCustomer.name} registrado exitosamente con el número ${newCustomer.phone}.`;
  },
  {
    name: "create_customer",
    description:
      "Registra un nuevo paciente usando su número de teléfono, nombre y correo electrónico.",
    schema: z.object({
      phone: z
        .string()
        .describe("Número de teléfono del paciente (lo conocemos)"),
      name: z.string().describe("Nombre completo del paciente"),
      email: z.string().describe("Correo electrónico del paciente"),
    }),
  }
);

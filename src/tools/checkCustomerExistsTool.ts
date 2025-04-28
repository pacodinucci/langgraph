import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";

export const checkCustomerExists = tool(
  async ({ phone }) => {
    const customer = await db.customer.findFirst({ where: { phone } });

    if (customer) {
      console.log(`Usuario con numero: ${customer.phone} existe`);
      return `EXISTS: ${customer.name}`;
    } else {
      console.log("Usuario no existe");
      return "NOT_FOUND";
    }
  },
  {
    name: "check_customer_exists",
    description:
      "Verifica si un paciente está registrado en la base de datos por su número de teléfono.",
    schema: z.object({
      phone: z.string().describe("Número de teléfono del paciente"),
    }),
  }
);

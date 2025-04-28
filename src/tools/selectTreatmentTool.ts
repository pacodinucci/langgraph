import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 🔥 Tratamientos válidos
export const validTreatments = [
  "Depilación Láser",
  "Tratamiento Facial",
  "Masajes",
  "Peeling",
  "Limpieza de Cutis",
];

// 🔥 Zonas válidas para depilación
export const validZones = [
  "piernas",
  "axilas",
  "bikini",
  "rostro",
  "brazos",
  "espalda",
  // podés agregar más zonas
];

export const selectTreatmentTool = tool(
  async ({ treatment, zones }) => {
    console.log("🛠️ Tratamiento seleccionado:", treatment, "Zonas:", zones);

    if (!validTreatments.includes(treatment)) {
      return `El tratamiento "${treatment}" no está disponible. Tratamientos disponibles: ${validTreatments.join(
        ", "
      )}.`;
    }

    if (treatment === "Depilación Láser") {
      if (!zones || zones.length === 0) {
        return `Para la Depilación Láser, por favor indicá qué zonas querés tratar. Opciones: ${validZones.join(
          ", "
        )}.`;
      }

      const invalidZones = zones.filter((z) => !validZones.includes(z));
      if (invalidZones.length > 0) {
        return `Las siguientes zonas no son válidas: ${invalidZones.join(
          ", "
        )}. Zonas válidas: ${validZones.join(", ")}.`;
      }

      return `Tratamiento de Depilación Láser confirmado para las zonas: ${zones.join(
        ", "
      )}.`;
    }

    return `Tratamiento confirmado: ${treatment}`;
  },
  {
    name: "select_treatment",
    description:
      "Confirma el tratamiento que el paciente quiere reservar. Para Depilación Láser, también pide las zonas.",
    schema: z.object({
      treatment: z
        .string()
        .describe(
          `Nombre del tratamiento deseado. Opciones: ${validTreatments.join(
            ", "
          )}.`
        ),
      zones: z
        .array(z.string())
        .optional()
        .describe(
          "Zonas a tratar en caso de elegir Depilación Láser. Opciones: piernas, axilas, bikini, rostro, brazos, espalda."
        ),
    }),
  }
);

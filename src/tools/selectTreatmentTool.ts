import { tool } from "@langchain/core/tools";
import { z } from "zod";
import db from "../../lib/db";
import { OpenAIEmbeddings } from "@langchain/openai";
import { cosineSimilarity } from "../../lib/cosineSimilarity";

// 🔥 Zonas válidas para depilación
const validZones = [
  "piernas",
  "axilas",
  "bikini",
  "rostro",
  "brazos",
  "espalda",
];

export const selectTreatmentTool = tool(
  async ({ treatment, zones }) => {
    console.log("🛠️ Tratamiento recibido:", treatment, "Zonas:", zones);

    // 🔍 Obtener todos los tratamientos de la base
    const allTreatments = await db.treatment.findMany();

    if (!allTreatments.length) {
      return "No hay tratamientos cargados en este momento.";
    }

    // 🔍 Buscar el más parecido usando embeddings
    const embeddings = new OpenAIEmbeddings();
    const userVector = await embeddings.embedQuery(treatment.toLowerCase());

    let bestMatch: { treatment: string; similarity: number } | null = null;

    for (const t of allTreatments) {
      const dbVector = await embeddings.embedQuery(t.name.toLowerCase());
      const similarity = cosineSimilarity(userVector, dbVector);

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { treatment: t.name, similarity };
      }
    }

    if (!bestMatch || bestMatch.similarity < 0.75) {
      return `No pude identificar el tratamiento "${treatment}". Intentá con otro nombre o pedí información primero.`;
    }

    const resolvedTreatment = bestMatch.treatment;

    if (resolvedTreatment === "Depilación Láser") {
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

    return `Tratamiento confirmado: ${resolvedTreatment}`;
  },
  {
    name: "select_treatment",
    description: "Confirma el tratamiento que el paciente quiere reservar.",
    schema: z.object({
      treatment: z
        .string()
        .describe("Texto que indique el tratamiento deseado."),
      zones: z.array(z.string()).optional(),
    }),
  }
);

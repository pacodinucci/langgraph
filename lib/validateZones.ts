import stringSimilarity from "string-similarity";
import db from "./db";

/**
 * Compara zonas ingresadas por el usuario con las zonas activas en la base de datos.
 * Usa similitud textual para aceptar errores menores o variaciones.
 */
export async function validateZones(userInputZones: string[], threshold = 0.6) {
  const matched: string[] = [];
  const invalid: string[] = [];

  const zonesFromDb = await db.zone.findMany();
  const validZones = zonesFromDb.map((z) => z.title.toLowerCase());

  console.log(validZones);

  for (const input of userInputZones.map((z) => z.toLowerCase())) {
    const { bestMatch } = stringSimilarity.findBestMatch(input, validZones);
    if (bestMatch.rating >= threshold) {
      matched.push(bestMatch.target);
    } else {
      invalid.push(input);
    }
  }

  return { matched, invalid };
}

(async () => {
  const result = await validateZones(["espalda", "brazos"]);
  console.log(result);
})();

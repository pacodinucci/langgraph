import db from "./db";

export async function validateZones(zones: string[]) {
  const zonasBD = await db.zone.findMany(); // tabla "zones"
  const zonasDisponibles = zonasBD.map((z) => z.title.toLowerCase());

  const zonasValidas: string[] = [];
  const zonasAmbiguas: Record<string, string[]> = {};

  // 🔥 Mapeo semántico explícito
  const zonaGeneralAMultiples: Record<string, string[]> = {
    piernas: ["pierna superior", "pierna inferior", "glúteos"],
    espalda: [
      "espalda superior",
      "espalda media",
      "espalda inferior",
      "espalda completa",
    ],
    brazos: ["brazo superior", "brazo inferior"],
    rostro: ["mentón", "pómulos", "bozo"],
  };

  for (const zonaUsuario of zones) {
    const zonaInput = zonaUsuario.toLowerCase();

    // 🔍 Coincidencia semántica definida
    if (zonaGeneralAMultiples[zonaInput]) {
      const mapeadas = zonaGeneralAMultiples[zonaInput].filter((z) =>
        zonasDisponibles.includes(z)
      );

      if (mapeadas.length > 0) {
        zonasValidas.push(...mapeadas);
        continue;
      }
    }

    // ✅ Coincidencia exacta
    if (zonasDisponibles.includes(zonaInput)) {
      zonasValidas.push(zonaInput);
      continue;
    }

    // 🔎 Coincidencias parciales
    const coincidencias = zonasDisponibles.filter((z) => z.includes(zonaInput));

    if (coincidencias.length === 1) {
      zonasValidas.push(coincidencias[0]);
    } else if (coincidencias.length > 1) {
      zonasAmbiguas[zonaUsuario] = coincidencias;
    } else {
      zonasAmbiguas[zonaUsuario] = [];
    }
  }

  return {
    zonasValidas,
    zonasAmbiguas,
  };
}

async function main() {
  const resultado = await validateZones(["espalda", "piernas", "hombros"]);
  console.log(resultado);
}

main();

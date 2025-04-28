import { parse } from "date-fns";
import { es } from "date-fns/locale";

function parseSpanishDate(dateStr: string): Date | null {
  try {
    const parsed = parse(dateStr, "d 'de' MMMM 'de' yyyy", new Date(), {
      locale: es,
    });
    return parsed;
  } catch (error) {
    console.error("Error al parsear la fecha:", error);
    return null;
  }
}

console.log(parseSpanishDate("5 de Mayo de 2025"));

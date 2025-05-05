import { parse, isBefore, endOfDay, isValid } from "date-fns";
import { es } from "date-fns/locale";

export function parseSpanishDate(dateStr: string): Date | null {
  const today = new Date();

  // 🚨 NUEVO: Si viene en formato yyyy-MM-dd, parsearlo directamente
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRegex.test(dateStr)) {
    const parsedISO = new Date(dateStr);
    return isValid(parsedISO) ? parsedISO : null;
  }

  const hasYear = /\d{4}/.test(dateStr);
  let fullDateStr = dateStr;

  if (!hasYear) {
    // Agregar el año actual inicialmente
    const currentYear = today.getFullYear();
    fullDateStr = `${dateStr} de ${currentYear}`;

    // Intentar parsear
    const parsed = parse(fullDateStr, "d 'de' MMMM 'de' yyyy", today, {
      locale: es,
    });

    // Si ya pasó este año, usar el siguiente año
    if (isBefore(endOfDay(parsed), today)) {
      fullDateStr = `${dateStr} de ${currentYear + 1}`;
    }
  }

  try {
    const finalParsed = parse(fullDateStr, "d 'de' MMMM 'de' yyyy", today, {
      locale: es,
    });
    return finalParsed;
  } catch (error) {
    console.error("Error al parsear la fecha:", error);
    return null;
  }
}

console.log(parseSpanishDate("2025-05-20"));

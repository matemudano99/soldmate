import Holidays from "date-holidays";

/**
 * Festivos laborales públicos de referencia para la capital de Málaga:
 * - Calendario estatal + Andalucía vía `date-holidays` (reglas alineadas con BOE en el paquete).
 * - Dos fiestas locales habituales del municipio de Málaga (no se modelizan traslados al lunes).
 *
 * Sirve para estimar picos o caídas de actividad; no sustituye al calendario oficial de tu empresa.
 */
const MALAGA_CITY_LOCAL: readonly { monthDay: string; name: string }[] = [
  { monthDay: "08-19", name: "Toma de Málaga (fiesta local)" },
  { monthDay: "09-08", name: "Virgen de la Victoria (fiesta local de Málaga)" },
];

let holidaysCache: Holidays | null = null;

function getHolidaysEngine(): Holidays {
  if (!holidaysCache) {
    holidaysCache = new Holidays("ES", "AN", {
      languages: "es",
      types: ["public", "bank"],
    });
  }
  return holidaysCache;
}

/** `YYYY-MM-DD` → lista de nombres de festivo (puede haber más de uno el mismo día). */
export function getMalagaCapitalPublicHolidaysByDate(isoFrom: string, isoTo: string): Map<string, string[]> {
  const from = isoFrom.slice(0, 10);
  const to = isoTo.slice(0, 10);
  const yStart = Number.parseInt(from.slice(0, 4), 10);
  const yEnd = Number.parseInt(to.slice(0, 4), 10);
  if (!Number.isFinite(yStart) || !Number.isFinite(yEnd) || yEnd < yStart) {
    return new Map();
  }

  const hd = getHolidaysEngine();
  const map = new Map<string, string[]>();

  const push = (iso: string, name: string) => {
    if (iso < from || iso > to) return;
    const list = map.get(iso) ?? [];
    if (!list.includes(name)) list.push(name);
    map.set(iso, list);
  };

  for (let y = yStart; y <= yEnd; y++) {
    for (const h of hd.getHolidays(y, "es")) {
      push(h.date.slice(0, 10), h.name);
    }
    for (const loc of MALAGA_CITY_LOCAL) {
      push(`${y}-${loc.monthDay}`, loc.name);
    }
  }

  return map;
}

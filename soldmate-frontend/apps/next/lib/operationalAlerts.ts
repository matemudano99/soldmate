import type { ForecastImpactDay } from "app/lib/api";
import {
  calendarYmdLocal,
  classifyForecastAlerts,
  formatDateShort,
  type OperationalAlertKind,
} from "app/lib/weather";
import { getMalagaCapitalPublicHolidaysByDate } from "./malagaPublicHolidays";

export interface OperationalAlertDay {
  date: string;
  kinds: OperationalAlertKind[];
  holidayNames: string[];
  forecast: ForecastImpactDay | null;
  summary: string;
}

const LOOKAHEAD_DAYS = 14;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return calendarYmdLocal(d);
}

function buildSummary(kinds: OperationalAlertKind[], fc: ForecastImpactDay | null, holidayNames: string[]): string {
  const parts: string[] = [];
  if (kinds.includes("rain") && fc) {
    parts.push(
      fc.rain >= 5 ? `Lluvia fuerte (~${fc.rain.toFixed(1)} mm)` : `Lluvia prevista (~${fc.rain.toFixed(1)} mm)`
    );
  }
  if (kinds.includes("heat") && fc) {
    parts.push(`Calor intenso (hasta ${fc.tempMax.toFixed(0)} °C)`);
  }
  if (kinds.includes("holiday") && holidayNames.length) {
    parts.push(holidayNames.join(" · "));
  }
  return parts.join(" · ") || "Revisar condiciones del día";
}

/**
 * Días próximos con lluvia, festivo público (ref. Málaga) o calor marcado.
 */
export function buildUpcomingOperationalAlerts(forecast: ForecastImpactDay[]): OperationalAlertDay[] {
  const today = calendarYmdLocal(new Date());
  const end = addDays(today, LOOKAHEAD_DAYS - 1);
  const holidays = getMalagaCapitalPublicHolidaysByDate(today, end);

  const forecastByDate = new Map<string, ForecastImpactDay>();
  for (const fc of forecast) {
    const iso = fc.date.slice(0, 10);
    if (iso >= today && iso <= end) {
      forecastByDate.set(iso, fc);
    }
  }

  const alerts: OperationalAlertDay[] = [];
  const cursor = new Date(`${today}T12:00:00`);

  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const iso = calendarYmdLocal(cursor);
    const fc = forecastByDate.get(iso) ?? null;
    const holidayNames = holidays.get(iso) ?? [];
    const kinds = new Set<OperationalAlertKind>(fc ? classifyForecastAlerts(fc) : []);
    if (holidayNames.length) kinds.add("holiday");

    if (kinds.size > 0) {
      alerts.push({
        date: iso,
        kinds: [...kinds],
        holidayNames,
        forecast: fc,
        summary: buildSummary([...kinds], fc, holidayNames),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return alerts;
}

export function formatOperationalDayTitle(iso: string): string {
  return formatDateShort(iso);
}

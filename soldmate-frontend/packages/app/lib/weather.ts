import type { ForecastImpactDay } from "./api";

export function getWorkloadScoreFromForecast(day: ForecastImpactDay): number {
  return day.impactScore;
}

export function getRecommendedLowLoadDays(days: ForecastImpactDay[], top = 3): ForecastImpactDay[] {
  return [...days].sort((a, b) => a.impactScore - b.impactScore).slice(0, top);
}

export function formatDateShort(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export function isBusinessOpenNow(openingHoursJson?: string | null): boolean {
  if (!openingHoursJson) return true;
  try {
    const data = JSON.parse(openingHoursJson) as Record<string, string>;
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const now = new Date();
    const key = dayKeys[now.getDay()];
    const value = data[key];
    if (!value || value.toUpperCase() === "CLOSED") return false;

    // Support comma-separated slots: "08:00-14:00,17:00-22:00"
    const slots = value.split(",").map((s) => s.trim());
    const minutes = now.getHours() * 60 + now.getMinutes();

    return slots.some((slot) => {
      const [start, end] = slot.split("-");
      if (!start || !end) return true;
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      return minutes >= sh * 60 + sm && minutes <= eh * 60 + em;
    });
  } catch {
    return true;
  }
}


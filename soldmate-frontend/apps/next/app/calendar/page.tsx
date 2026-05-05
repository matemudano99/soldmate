"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, CloudRain, Wind, Thermometer, Loader2 } from "lucide-react";
import { SectionCard } from "../components/web-ui";
import { CreateCalendarTaskModal, WebErpNavbar } from "../shared/ui";
import { businessProfileApi, calendarApi, forecastApi, type CalendarEventResponse, type ForecastImpactDay } from "app/lib/api";
import { describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { getRecommendedLowLoadDays } from "app/lib/weather";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const EVENTS = [
  { day: "Mon", title: "Reunión equipo", time: "09:00", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { day: "Wed", title: "Entrega informe", time: "12:00", color: "bg-violet-50 border-violet-200 text-violet-700" },
  { day: "Thu", title: "Revisión stock", time: "16:00", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { day: "Fri", title: "Cierre semanal", time: "17:30", color: "bg-green-50 border-green-200 text-green-700" },
];

const CITY = { label: "negocio" };

function formatTimelineDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export default function CalendarPage() {
  const token = useAuthStore((s) => s.token);
  const [events, setEvents] = useState<CalendarEventResponse[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [forecast, setForecast] = useState<ForecastImpactDay[]>([]);
  const [businessCity, setBusinessCity] = useState<string>(CITY.label);
  const [loadingForecast, setLoadingForecast] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const weekDates = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const diff = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - diff);
    return DAYS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { label, iso };
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    async function load() {
      try {
        setEventsError(null);
        const loaded = await calendarApi.getAll(token, weekDates[0].iso, weekDates[6].iso);
        setEvents(loaded);
      } catch (error) {
        setEventsError(describeNetworkError(error));
        // fallback local
        setEvents(
          EVENTS.map((e, idx) => ({
            id: idx + 1,
            title: e.title,
            notes: null,
            eventDate: weekDates[idx % weekDates.length].iso,
            eventTime: `${e.time}:00`,
            source: "MOCK",
          })),
        );
      }
      try {
        setLoadingForecast(true);
        setForecastError(null);
        const business = await businessProfileApi.get(token);
        setBusinessCity(business.city || business.businessName || CITY.label);
        const weather = await forecastApi.getImpact(token);
        setForecast(weather);
      } catch (error) {
        setForecastError(describeNetworkError(error));
      } finally {
        setLoadingForecast(false);
      }
    }
    load();
  }, [token, weekDates]);

  const lowerLoadDates = useMemo(
    () => new Set(getRecommendedLowLoadDays(forecast, 3).map((item) => item.date)),
    [forecast],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventResponse>();
    for (const e of events) {
      if (!map.has(e.eventDate)) map.set(e.eventDate, e);
    }
    return map;
  }, [events]);

  return (
    <div className="flex min-h-screen bg-[#eef1f8]">
      <WebErpNavbar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-[#1e2040]">Calendario</h1>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#3d5ae0]">
            <Plus size={14} />
            Crear tarea
          </button>
        </div>
        <SectionCard title="Esta semana" subtitle="Mock data · frontend-first">
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((d) => {
              const event = eventsByDate.get(d.iso);
              return (
                <div key={d.iso} className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">{d.label}</p>
                  <div
                    className={`rounded-xl p-2.5 min-h-[80px] border ${
                      event ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    {event && (
                      <>
                        <p className="text-[9px] opacity-70">{(event.eventTime ?? "").slice(0, 5)}</p>
                        <p className="text-[10px] font-semibold mt-1 leading-tight">{event.title}</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {eventsError && <p className="text-xs text-amber-600 mt-3">{eventsError}</p>}
        </SectionCard>
        <div className="mt-4">
          <SectionCard
            title="Línea del tiempo climática"
            subtitle={`Pronóstico 7 días (${businessCity}) con estimación de menor volumen de trabajo`}
          >
            {loadingForecast && (
              <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-500 flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                Cargando pronóstico...
              </div>
            )}

            {forecastError && !loadingForecast && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                {forecastError}
              </div>
            )}

            {!loadingForecast && !forecastError && (
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-blue-100" />
                <div className="space-y-3">
                  {forecast.map((day) => {
                    const recommended = lowerLoadDates.has(day.date);
                    return (
                      <article
                        key={day.date}
                        className={`relative rounded-xl border p-3.5 ${
                          recommended
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-gray-100 bg-white"
                        }`}
                      >
                        <span
                          className={`absolute -left-[18px] top-5 w-3.5 h-3.5 rounded-full border-2 ${
                            recommended
                              ? "bg-emerald-500 border-emerald-100"
                              : "bg-[#4f6ef7] border-blue-100"
                          }`}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-[#1e2040] capitalize">
                            {formatTimelineDate(day.date)}
                          </p>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              recommended
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-blue-50 text-[#4f6ef7]"
                            }`}
                          >
                            Índice carga: {day.impactScore}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                          <p className="inline-flex items-center gap-1">
                            <CloudRain size={13} /> {day.rain.toFixed(1)} mm
                          </p>
                          <p className="inline-flex items-center gap-1">
                            <Wind size={13} /> {day.wind.toFixed(1)} km/h
                          </p>
                          <p className="inline-flex items-center gap-1">
                            <Thermometer size={13} /> {day.tempMax.toFixed(1)} °C
                          </p>
                        </div>
                        <p className="mt-2 text-xs text-gray-600">{day.recommendation}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
        {showCreate && (
          <CreateCalendarTaskModal
            onClose={() => setShowCreate(false)}
            days={DAYS}
            onCreate={async (payload) => {
              if (!token) return;
              const map: Record<string, number> = {
                Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
                Lun: 0, Mar: 1, Mié: 2, Jue: 3, Vie: 4, Sáb: 5, Dom: 6,
              };
              const idx = map[payload.day] ?? 0;
              const date = weekDates[idx]?.iso ?? weekDates[0].iso;
              try {
                const created = await calendarApi.create(token, {
                  title: payload.title,
                  eventDate: date,
                  eventTime: payload.time,
                });
                setEvents((prev) => [...prev, created]);
              } catch {
                // fallback local sin bloquear el modal
                setEvents((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    title: payload.title,
                    notes: null,
                    eventDate: date,
                    eventTime: `${payload.time}:00`,
                    source: "LOCAL_FALLBACK",
                  },
                ]);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

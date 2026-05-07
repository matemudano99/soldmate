"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, CloudRain, Wind, Thermometer, Loader2, Pencil, Trash2 } from "lucide-react";
import { SectionCard } from "../components/web-ui";
import { AppTopHeader, CreateCalendarTaskModal, WebErpNavbar, notify, useConfirm } from "../shared/ui";
import { businessProfileApi, calendarApi, forecastApi, type CalendarEventResponse, type ForecastImpactDay } from "app/lib/api";
import { describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { getRecommendedLowLoadDays } from "app/lib/weather";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAY_STYLES = [
  { header: "text-blue-600", shell: "bg-blue-50 border-blue-200", task: "border-blue-200 text-blue-700" },
  { header: "text-violet-600", shell: "bg-violet-50 border-violet-200", task: "border-violet-200 text-violet-700" },
  { header: "text-emerald-600", shell: "bg-emerald-50 border-emerald-200", task: "border-emerald-200 text-emerald-700" },
  { header: "text-amber-600", shell: "bg-amber-50 border-amber-200", task: "border-amber-200 text-amber-700" },
  { header: "text-pink-600", shell: "bg-pink-50 border-pink-200", task: "border-pink-200 text-pink-700" },
  { header: "text-cyan-600", shell: "bg-cyan-50 border-cyan-200", task: "border-cyan-200 text-cyan-700" },
  { header: "text-indigo-600", shell: "bg-indigo-50 border-indigo-200", task: "border-indigo-200 text-indigo-700" },
] as const;

const CITY = { label: "negocio" };
const RAIN_ALERT_MM = 1.0;
const STRONG_WIND_KMH = 35;

function formatTimelineDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function isAdverseWeather(day: ForecastImpactDay): boolean {
  return day.rain >= RAIN_ALERT_MM || day.wind >= STRONG_WIND_KMH;
}

function lowerSalesReason(day: ForecastImpactDay): string {
  const reasons: string[] = [];
  if (day.rain >= RAIN_ALERT_MM) reasons.push("lluvia prevista");
  if (day.wind >= STRONG_WIND_KMH) reasons.push("viento intenso");
  if (!reasons.length) return "Menor afluencia esperada por condiciones generales del día.";
  return `Menor volumen de ventas esperado por ${reasons.join(" y ")}.`;
}

export default function CalendarPage() {
  const token = useAuthStore((s) => s.token);
  const [events, setEvents] = useState<CalendarEventResponse[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarEventResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastImpactDay[]>([]);
  const [businessCity, setBusinessCity] = useState<string>(CITY.label);
  const [loadingForecast, setLoadingForecast] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

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
    const authToken = token;
    if (!authToken) return;
    async function load() {
      try {
        setEventsError(null);
        const loaded = await calendarApi.getAll(authToken!, weekDates[0].iso, weekDates[6].iso);
        setEvents(loaded);
      } catch (error) {
        setEventsError(describeNetworkError(error));
        setEvents([]);
      }
      try {
        setLoadingForecast(true);
        setForecastError(null);
        const business = await businessProfileApi.get(authToken!);
        setBusinessCity(business.city || business.businessName || CITY.label);
        const weather = await forecastApi.getImpact(authToken!);
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
    const map = new Map<string, CalendarEventResponse[]>();
    for (const e of events) {
      const current = map.get(e.eventDate) ?? [];
      current.push(e);
      map.set(e.eventDate, current);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => (a.eventTime ?? "").localeCompare(b.eventTime ?? ""));
      map.set(key, list);
    }
    return map;
  }, [events]);

  async function handleDeleteTask(task: CalendarEventResponse) {
    const ok = await confirm(`¿Eliminar la tarea "${task.title}"?`, "Esta acción no se puede deshacer.", "danger");
    if (!ok) return;
    setTaskActionError(null);
    const prev = events;
    setEvents((current) => current.filter((e) => e.id !== task.id));
    if (!token) return;
    try {
      await calendarApi.remove(token, task.id);
      notify.success("Tarea eliminada");
    } catch (error) {
      setEvents(prev);
      const msg = describeNetworkError(error);
      setTaskActionError(msg);
      notify.error(msg);
    }
  }

  async function handleEditTask(task: CalendarEventResponse) {
    setEditingTask(task);
  }

  async function handleSubmitEdit(payload: { day: string; time: string; title: string }) {
    if (!editingTask || !token) return;
    const map: Record<string, number> = {
      Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
      Lun: 0, Mar: 1, Mié: 2, Jue: 3, Vie: 4, Sáb: 5, Dom: 6,
    };
    const idx = map[payload.day] ?? 0;
    const nextDate = weekDates[idx]?.iso ?? editingTask.eventDate;

    setTaskActionError(null);
    const prev = events;
    setEvents((current) =>
      current.map((e) =>
        e.id === editingTask.id
          ? { ...e, title: payload.title, eventDate: nextDate, eventTime: `${payload.time}:00` }
          : e,
      ),
    );
    setEditingTask(null);

    try {
      await calendarApi.update(token, editingTask.id, {
        title: payload.title,
        eventDate: nextDate,
        eventTime: payload.time,
      });
    } catch (error) {
      setEvents(prev);
      setTaskActionError(describeNetworkError(error));
    }
  }

  return (
    <div className="flex min-h-screen bg-[#eef1f8]">
      <WebErpNavbar />
      <main className="flex-1 pb-6 overflow-y-auto">
        <AppTopHeader />
        <div className="px-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-[#1e2040]">Calendario</h1>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#4f6ef7] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#3d5ae0]">
            <Plus size={14} />
            Crear tarea
          </button>
        </div>
        <SectionCard title="Esta semana" subtitle="Eventos reales del calendario">
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((d) => {
              const dayEvents = eventsByDate.get(d.iso) ?? [];
              const style = DAY_STYLES[DAYS.indexOf(d.label)] ?? DAY_STYLES[0];
              return (
                <div key={d.iso} className="flex flex-col gap-1.5">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider text-center ${style.header}`}>{d.label}</p>
                  <div className={`rounded-xl p-2.5 min-h-[120px] border ${dayEvents.length ? style.shell : "bg-gray-50 border-gray-100"}`}>
                    {dayEvents.length ? (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {dayEvents.map((event) => (
                          <div key={event.id} className={`rounded-lg border bg-white/80 p-2 ${style.task}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[9px] opacity-70">{(event.eventTime ?? "").slice(0, 5)}</p>
                                <p className="text-[10px] font-semibold mt-0.5 leading-tight">{event.title}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditTask(event)}
                                  className="rounded-md p-1 hover:bg-white/70"
                                  title="Editar tarea"
                                >
                                  <Pencil size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(event)}
                                  className="rounded-md p-1 hover:bg-white/70"
                                  title="Eliminar tarea"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 text-center pt-6">Sin tareas</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {eventsError && <p className="text-xs text-amber-600 mt-3">{eventsError}</p>}
          {taskActionError && <p className="text-xs text-amber-600 mt-1">{taskActionError}</p>}
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
                    const adverse = isAdverseWeather(day);
                    return (
                      <article
                        key={day.date}
                        className={`relative rounded-xl border p-3.5 ${
                          adverse
                            ? "border-amber-200 bg-amber-50"
                            : recommended
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-gray-100 bg-white"
                        }`}
                      >
                        <span
                          className={`absolute -left-[18px] top-5 w-3.5 h-3.5 rounded-full border-2 ${
                            adverse
                              ? "bg-amber-500 border-amber-100"
                              : recommended
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
                              adverse
                                ? "bg-amber-100 text-amber-700"
                                : recommended
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
                        {(recommended || adverse) ? (
                          <p className={`mt-1.5 text-xs font-medium ${adverse ? "text-amber-700" : "text-emerald-700"}`}>
                            {lowerSalesReason(day)}
                          </p>
                        ) : null}
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
            onCreate={async (payload: { day: string; time: string; title: string }) => {
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
              } catch (error) {
                setTaskActionError(describeNetworkError(error));
              }
            }}
          />
        )}
        {editingTask && (
          <CreateCalendarTaskModal
            onClose={() => setEditingTask(null)}
            submitLabel="Guardar cambios"
            days={DAYS}
            initial={{
              title: editingTask.title,
              time: (editingTask.eventTime ?? "09:00").slice(0, 5),
              day: weekDates.find((d) => d.iso === editingTask.eventDate)?.label ?? DAYS[0],
            }}
            onCreate={handleSubmitEdit}
          />
        )}
        </div>
      </main>
      {confirmDialog}
    </div>
  );
}

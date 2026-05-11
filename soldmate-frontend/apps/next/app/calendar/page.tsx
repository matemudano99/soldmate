"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus, CloudRain, Wind, Thermometer, Loader2, Pencil, Trash2, CalendarDays } from "lucide-react";
import { SectionCard } from "../components/web-ui";
import { AppTopHeader, CreateCalendarTaskModal, WebErpNavbar, notify, useConfirm } from "../shared/ui";
import { businessProfileApi, calendarApi, forecastApi, type CalendarEventResponse, type ForecastImpactDay } from "app/lib/api";
import { describeNetworkError } from "app/lib/api";
import { useAuthStore } from "app/lib/store";
import { getRecommendedLowLoadDays } from "app/lib/weather";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const DAY_STRIP = [
  "border-l-4 border-l-blue-500 bg-blue-50/60",
  "border-l-4 border-l-violet-500 bg-violet-50/60",
  "border-l-4 border-l-emerald-500 bg-emerald-50/60",
  "border-l-4 border-l-amber-500 bg-amber-50/60",
  "border-l-4 border-l-pink-500 bg-pink-50/60",
  "border-l-4 border-l-cyan-500 bg-cyan-50/60",
  "border-l-4 border-l-indigo-500 bg-indigo-50/60",
] as const;

const TASK_CHIP = [
  "border-blue-200 bg-white text-blue-800",
  "border-violet-200 bg-white text-violet-800",
  "border-emerald-200 bg-white text-emerald-800",
  "border-amber-200 bg-white text-amber-900",
  "border-pink-200 bg-white text-pink-800",
  "border-cyan-200 bg-white text-cyan-800",
  "border-indigo-200 bg-white text-indigo-800",
] as const;

const CITY = { label: "negocio" };
const RAIN_ALERT_MM = 1.0;
const STRONG_WIND_KMH = 35;
const TASK_PREVIEW_COUNT = 4;

function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayTitle(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = d.toLocaleDateString("es-ES", { weekday: "long" });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const rest = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${cap} ${rest}`;
}

function normalizeForecastDate(date: string): string {
  return date.slice(0, 10);
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

function ExpandableParagraph({
  text,
  id,
  expanded,
  onToggle,
}: {
  text: string;
  id: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (expanded) {
      setOverflows(true);
      return;
    }
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [text, expanded, id]);

  if (!text.trim()) return null;

  return (
    <div className="space-y-1">
      <p
        ref={ref}
        id={id}
        className={`text-xs leading-relaxed text-gray-600 ${expanded ? "" : "line-clamp-3"}`}
      >
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-semibold text-[#4f6ef7] hover:underline"
          aria-expanded={expanded}
          aria-controls={id}
        >
          {expanded ? "Mostrar menos" : "Mostrar más"}
        </button>
      ) : null}
    </div>
  );
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
  const [weatherExpandedByIso, setWeatherExpandedByIso] = useState<Record<string, boolean>>({});
  const [tasksExpandedByIso, setTasksExpandedByIso] = useState<Record<string, boolean>>({});
  const { confirm, dialog: confirmDialog } = useConfirm();

  const todayStr = localIso(new Date());

  const weekDates = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const diff = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - diff);
    return DAYS.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = localIso(d);
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
    () => new Set(getRecommendedLowLoadDays(forecast, 3).map((item) => normalizeForecastDate(item.date))),
    [forecast],
  );

  const forecastByIso = useMemo(() => {
    const m = new Map<string, ForecastImpactDay>();
    for (const f of forecast) {
      m.set(normalizeForecastDate(f.date), f);
    }
    return m;
  }, [forecast]);

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
      <main className="flex-1 overflow-y-auto pb-6">
        <AppTopHeader />
        <div className="px-4 sm:px-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#1e2040] sm:text-2xl">Calendario</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Semana con clima y tareas en un solo listado · {businessCity}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#4f6ef7] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3d5ae0] sm:w-auto sm:py-2.5"
            >
              <Plus size={14} />
              Crear tarea
            </button>
          </div>

          <SectionCard
            title="Vista semanal"
            subtitle="Cada fila es un día: primero el pronóstico operativo, después tus tareas."
          >
            {forecastError && !loadingForecast && (
              <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {forecastError}
              </div>
            )}

            <div className="space-y-4">
              {weekDates.map((d, dayIndex) => {
                const fc = forecastByIso.get(d.iso);
                const dayEvents = eventsByDate.get(d.iso) ?? [];
                const isToday = d.iso === todayStr;
                const strip = DAY_STRIP[dayIndex] ?? DAY_STRIP[0];
                const taskTone = TASK_CHIP[dayIndex] ?? TASK_CHIP[0];
                const recommended = lowerLoadDates.has(d.iso);
                const adverse = fc ? isAdverseWeather(fc) : false;

                return (
                  <article
                    key={d.iso}
                    className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_2px_14px_rgba(149,157,165,0.08)] ${isToday ? "ring-2 ring-[#4f6ef7]/35" : ""}`}
                  >
                    <div className="flex flex-col sm:flex-row">
                      <div
                        className={`flex shrink-0 flex-col justify-center border-b border-gray-100 px-4 py-3 sm:w-48 sm:border-b-0 sm:border-r sm:border-gray-100 ${strip}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase tracking-wide text-[#1e2040]/80`}>{d.label}</span>
                          {isToday ? (
                            <span className="rounded-full bg-[#4f6ef7] px-2 py-0.5 text-[10px] font-semibold text-white">
                              Hoy
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm font-semibold text-[#1e2040]">{formatDayTitle(d.iso)}</p>
                      </div>

                      <div className="min-w-0 flex-1 px-4 py-3">
                        {loadingForecast && !forecastError ? (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 size={14} className="animate-spin" />
                            Cargando clima…
                          </div>
                        ) : fc ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  adverse
                                    ? "bg-amber-100 text-amber-800"
                                    : recommended
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-blue-50 text-[#4f6ef7]"
                                }`}
                              >
                                Carga {fc.impactScore}
                              </span>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                                <span className="inline-flex items-center gap-1">
                                  <CloudRain size={13} className="text-sky-500" />
                                  {fc.rain.toFixed(1)} mm
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Wind size={13} className="text-slate-500" />
                                  {fc.wind.toFixed(1)} km/h
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Thermometer size={13} className="text-orange-500" />
                                  {fc.tempMax.toFixed(0)} °C
                                </span>
                              </div>
                            </div>
                            <ExpandableParagraph
                              text={fc.recommendation}
                              id={`cal-weather-rec-${d.iso}`}
                              expanded={Boolean(weatherExpandedByIso[d.iso])}
                              onToggle={() =>
                                setWeatherExpandedByIso((prev) => ({
                                  ...prev,
                                  [d.iso]: !prev[d.iso],
                                }))
                              }
                            />
                            {recommended || adverse ? (
                              <p className={`text-xs font-medium ${adverse ? "text-amber-800" : "text-emerald-800"}`}>
                                {lowerSalesReason(fc)}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">
                            Sin datos de clima para esta fecha en el pronóstico actual.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-gray-100 bg-[#fafbff] px-4 py-3">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        <CalendarDays size={12} />
                        Tareas
                      </div>
                      {dayEvents.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-gray-200 bg-white/80 py-6 text-center text-sm text-gray-400">
                          Sin tareas este día
                        </p>
                      ) : (
                        <>
                          <ul className="space-y-2">
                            {(tasksExpandedByIso[d.iso] ? dayEvents : dayEvents.slice(0, TASK_PREVIEW_COUNT)).map(
                              (event) => (
                                <li
                                  key={event.id}
                                  className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${taskTone}`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-gray-500">{(event.eventTime ?? "").slice(0, 5)}</p>
                                    <p className="mt-0.5 text-sm font-semibold leading-snug text-[#1e2040]">
                                      {event.title}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleEditTask(event)}
                                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-gray-200/80 bg-white/90 text-gray-600 hover:bg-white"
                                      title="Editar tarea"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTask(event)}
                                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-red-100 bg-white/90 text-red-500 hover:bg-red-50"
                                      title="Eliminar tarea"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </li>
                              ),
                            )}
                          </ul>
                          {dayEvents.length > TASK_PREVIEW_COUNT ? (
                            <button
                              type="button"
                              onClick={() =>
                                setTasksExpandedByIso((prev) => ({
                                  ...prev,
                                  [d.iso]: !prev[d.iso],
                                }))
                              }
                              className="mt-2 text-xs font-semibold text-[#4f6ef7] hover:underline"
                            >
                              {tasksExpandedByIso[d.iso]
                                ? "Mostrar menos"
                                : `Mostrar más (${dayEvents.length - TASK_PREVIEW_COUNT} más)`}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {eventsError ? <p className="mt-3 text-xs text-amber-600">{eventsError}</p> : null}
            {taskActionError ? <p className="mt-1 text-xs text-amber-600">{taskActionError}</p> : null}
          </SectionCard>

          {showCreate && (
            <CreateCalendarTaskModal
              onClose={() => setShowCreate(false)}
              days={[...DAYS]}
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
              days={[...DAYS]}
              initial={{
                title: editingTask.title,
                time: (editingTask.eventTime ?? "09:00").slice(0, 5),
                day: weekDates.find((wd) => wd.iso === editingTask.eventDate)?.label ?? DAYS[0],
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

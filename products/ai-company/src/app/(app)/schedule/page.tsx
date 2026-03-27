"use client";

import { useEffect, useState, useMemo } from "react";
import * as api from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { EmployeeAvatar } from "@/components/employee-avatar";
import type { ScheduleEvent } from "@/types";

type ViewMode = "calendar" | "list";

const typeColors: Record<string, { color: string; bg: string; border: string }> = {
  meeting: { color: "var(--color-primary)", bg: "var(--color-primary-light)", border: "var(--color-primary)" },
  deadline: { color: "var(--color-danger)", bg: "var(--color-danger-light)", border: "var(--color-danger)" },
  review: { color: "var(--color-info)", bg: "var(--color-info-light)", border: "var(--color-info)" },
  other: { color: "var(--color-subtext)", bg: "var(--color-border-light)", border: "var(--color-subtext)" },
};

const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdaysJa = ["日", "月", "火", "水", "木", "金", "土"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  const days: { date: number; month: number; year: number; current: boolean }[] = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ date: daysInPrev - i, month: month - 1, year: month === 0 ? year - 1 : year, current: false });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: i, month, year, current: true });
  }
  // Next month padding
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: i, month: month + 1, year: month === 11 ? year + 1 : year, current: false });
  }
  return days;
}

function toDateStr(year: number, month: number, date: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [view, setView] = useState<ViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { t, locale } = useI18n();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  useEffect(() => {
    api.getScheduleEvents().then(setEvents);
  }, []);

  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, ScheduleEvent[]>>((acc, evt) => {
      if (!acc[evt.date]) acc[evt.date] = [];
      acc[evt.date].push(evt);
      return acc;
    }, {});
  }, [events]);

  const calendarDays = useMemo(() => getCalendarDays(currentYear, currentMonth), [currentYear, currentMonth]);
  const weekdays = locale === "ja" ? weekdaysJa : weekdaysEn;

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };
  const goToday = () => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); setSelectedDate(todayStr); };

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "long" });

  // Selected date events
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];

  // List view helpers
  const sortedDates = Object.keys(eventsByDate).sort();
  const formatDate = (dateStr: string) => {
    if (dateStr === todayStr) return t.schedule.today;
    return new Date(dateStr + "T00:00:00").toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div className="px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.schedule.title}</h1>
          <p className="text-sm text-[var(--color-subtext)] mt-0.5">{t.schedule.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-[var(--color-border-light)] rounded-lg p-0.5">
            <button
              onClick={() => setView("calendar")}
              className={`p-1.5 rounded-md transition-colors ${view === "calendar" ? "bg-white shadow-sm text-[var(--color-primary)]" : "text-[var(--color-subtext)]"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-white shadow-sm text-[var(--color-primary)]" : "text-[var(--color-subtext)]"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </button>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t.schedule.createEvent}
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-[var(--color-border)] p-5">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-5">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)] text-[var(--color-subtext)] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-[var(--color-text)]">{monthLabel}</h2>
                <button onClick={goToday} className="text-xs font-medium px-2.5 py-1 bg-[var(--color-border-light)] text-[var(--color-subtext)] rounded-md hover:bg-[var(--color-border)] transition-colors">
                  {t.schedule.today}
                </button>
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)] text-[var(--color-subtext)] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-1">
              {weekdays.map((d, i) => (
                <div key={d} className={`text-center text-[10px] font-medium py-2 ${i === 0 ? "text-[var(--color-danger)]" : i === 6 ? "text-[var(--color-info)]" : "text-[var(--color-subtext)]"}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day Grid */}
            <div className="grid grid-cols-7 border-t border-l border-[var(--color-border)]">
              {calendarDays.map((day, i) => {
                const dateStr = toDateStr(day.year, day.month, day.date);
                const dayEvents = eventsByDate[dateStr] ?? [];
                const isCurrentDay = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dayOfWeek = i % 7;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`relative border-r border-b border-[var(--color-border)] p-1 min-h-[80px] text-left transition-colors hover:bg-[var(--color-border-light)] ${
                      !day.current ? "bg-[var(--color-bg)]" : isSelected ? "bg-[var(--color-primary-light)]" : "bg-white"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                      isCurrentDay
                        ? "bg-[var(--color-primary)] text-white"
                        : !day.current
                          ? "text-[var(--color-border)]"
                          : dayOfWeek === 0
                            ? "text-[var(--color-danger)]"
                            : dayOfWeek === 6
                              ? "text-[var(--color-info)]"
                              : "text-[var(--color-text)]"
                    }`}>
                      {day.date}
                    </span>
                    {/* Event dots */}
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 3).map((evt) => {
                        const tc = typeColors[evt.type] ?? typeColors.other;
                        return (
                          <div
                            key={evt.id}
                            className="text-[8px] leading-tight px-1 py-0.5 rounded truncate font-medium"
                            style={{ backgroundColor: tc.bg, color: tc.color }}
                          >
                            {evt.startTime} {evt.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[8px] text-[var(--color-subtext)] px-1">+{dayEvents.length - 3}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar: Selected Date Events */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <h3 className="font-semibold text-[var(--color-text)] mb-4">
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", { month: "long", day: "numeric", weekday: "long" })
                : t.schedule.upcoming}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-[var(--color-subtext)] py-8 text-center">{t.schedule.noEvents}</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((evt) => {
                  const tc = typeColors[evt.type] ?? typeColors.other;
                  const typeLabel = (t.schedule.eventType as Record<string, string>)[evt.type] ?? evt.type;
                  return (
                    <div
                      key={evt.id}
                      className="p-3 rounded-lg border border-[var(--color-border)]"
                      style={{ borderLeftWidth: "3px", borderLeftColor: tc.border }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-[var(--color-text)]">{evt.startTime}</span>
                        {evt.startTime !== evt.endTime && (
                          <span className="text-[10px] text-[var(--color-subtext)]">— {evt.endTime}</span>
                        )}
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded ml-auto" style={{ backgroundColor: tc.bg, color: tc.color }}>
                          {typeLabel}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{evt.title}</p>
                      <p className="text-xs text-[var(--color-subtext)] mt-0.5 line-clamp-2">{evt.description}</p>
                      <div className="flex -space-x-1.5 mt-2">
                        {evt.employeeIds.slice(0, 4).map((eid) => (
                          <EmployeeAvatar key={eid} seed={eid} size="1.25rem" className="border border-white rounded-full" />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* List View */
        events.length === 0 ? (
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
            <p className="text-sm text-[var(--color-subtext)]">{t.schedule.noEvents}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateStr) => {
              const dayEvents = eventsByDate[dateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));
              const isCurrentDay = dateStr === todayStr;
              const past = dateStr < todayStr;
              return (
                <div key={dateStr}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                      isCurrentDay ? "bg-[var(--color-primary)] text-white" : past ? "bg-[var(--color-border-light)] text-[var(--color-subtext)]" : "bg-[var(--color-border-light)] text-[var(--color-text)]"
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      {formatDate(dateStr)}
                    </div>
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                  </div>
                  <div className="space-y-2 ml-2">
                    {dayEvents.map((evt) => {
                      const tc = typeColors[evt.type] ?? typeColors.other;
                      const typeLabel = (t.schedule.eventType as Record<string, string>)[evt.type] ?? evt.type;
                      return (
                        <div key={evt.id} className="bg-white rounded-xl border border-[var(--color-border)] p-4 hover:shadow-sm transition-all" style={{ borderLeftWidth: "3px", borderLeftColor: tc.border }}>
                          <div className="flex items-start gap-4">
                            <div className="shrink-0 w-14 text-center">
                              <p className="text-sm font-semibold text-[var(--color-text)]">{evt.startTime}</p>
                              {evt.startTime !== evt.endTime && <p className="text-[10px] text-[var(--color-subtext)]">{evt.endTime}</p>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-medium text-[var(--color-text)] truncate">{evt.title}</h3>
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: tc.bg, color: tc.color }}>{typeLabel}</span>
                              </div>
                              <p className="text-xs text-[var(--color-subtext)] line-clamp-1">{evt.description}</p>
                            </div>
                            <div className="flex -space-x-1.5 shrink-0">
                              {evt.employeeIds.slice(0, 3).map((eid) => (
                                <EmployeeAvatar key={eid} seed={eid} size="1.25rem" className="border border-white rounded-full" />
                              ))}
                              {evt.employeeIds.length > 3 && (
                                <div className="w-5 h-5 rounded-full bg-[var(--color-border-light)] border border-white flex items-center justify-center text-[8px] font-medium text-[var(--color-subtext)]">+{evt.employeeIds.length - 3}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

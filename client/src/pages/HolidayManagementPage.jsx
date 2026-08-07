import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CalendarCheck2, CalendarDays, Clock3, Tags } from "lucide-react";
import HolidayTable from "../components/manageholiday/HolidayTable";
import HolidayForm from "../components/manageholiday/HolidayForm";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const HolidayManagementPage = ({ onLogout }) => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/holidays`);
      setHolidays(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    } finally {
      setLoading(false);
    }
  };

  const addHoliday = async (holidayData) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/holidays`,
        holidayData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      setHolidays((current) => [...current, response.data]);
    } catch (error) {
      console.error("Error creating holiday:", error);
      throw error;
    }
  };

  const updateHoliday = async (id, holidayData) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/holidays/${id}`,
        holidayData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );
      setHolidays((current) =>
        current.map((holiday) =>
          holiday._id === id ? response.data : holiday,
        ),
      );
      setEditingHoliday(null);
    } catch (error) {
      console.error("Error updating holiday:", error);
      throw error;
    }
  };

  const deleteHoliday = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/holidays/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setHolidays((current) =>
        current.filter((holiday) => holiday._id !== id),
      );
      if (editingHoliday?._id === id) setEditingHoliday(null);
    } catch (error) {
      console.error("Error deleting holiday:", error);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const summary = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const currentYear = now.getFullYear();
    const thisYear = holidays.filter(
      (holiday) => new Date(holiday.date).getFullYear() === currentYear,
    );
    const upcoming = thisYear.filter(
      (holiday) => new Date(holiday.date) >= now,
    ).length;
    const types = new Set(thisYear.map((holiday) => holiday.type).filter(Boolean));
    return { total: holidays.length, thisYear: thisYear.length, upcoming, types: types.size };
  }, [holidays]);

  const metrics = [
    ["All holidays", summary.total, CalendarDays, "text-blue-600 dark:text-blue-300"],
    ["This year", summary.thisYear, CalendarCheck2, "text-emerald-600 dark:text-emerald-300"],
    ["Upcoming", summary.upcoming, Clock3, "text-amber-600 dark:text-amber-300"],
    ["Holiday types", summary.types, Tags, "text-violet-600 dark:text-violet-300"],
  ];

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole="admin"
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          sidebarCollapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
              <CalendarDays className="h-3.5 w-3.5" />
              Company calendar
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Holiday management
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Maintain company holidays and the shifts each date applies to.
            </p>
          </header>

          <section
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="Holiday summary"
          >
            {metrics.map(([label, value, Icon, tone]) => (
              <article
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                      {loading ? "—" : value}
                    </p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.05]">
                    {React.createElement(Icon, {
                      className: `h-4 w-4 ${tone}`,
                    })}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                {editingHoliday ? "Edit holiday" : "Add a holiday"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {editingHoliday
                  ? "Update the selected holiday’s details."
                  : "Add a single date or create the same holiday across a date range."}
              </p>
            </div>
            <HolidayForm
              onAdd={addHoliday}
              onUpdate={updateHoliday}
              editingHoliday={editingHoliday}
              onCancelEdit={() => setEditingHoliday(null)}
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Holiday calendar
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {holidays.length} configured {holidays.length === 1 ? "holiday" : "holidays"}
                </p>
              </div>
              {loading && (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600 dark:border-white/10 dark:border-t-blue-400" />
              )}
            </div>
            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]"
                    />
                  ))}
                </div>
              ) : (
                <HolidayTable
                  holidays={holidays}
                  onDelete={deleteHoliday}
                  onEdit={setEditingHoliday}
                />
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default HolidayManagementPage;

import React, { useState } from "react";
import { CalendarClock, CalendarSearch, Clock3, Repeat2, UserRoundCog } from "lucide-react";
import {
  ShiftsManager,
  EmployeeShiftAssignment,
  ShiftChangeRequest,
  EffectiveShiftViewer,
} from "../components/Shift";
import Sidebar from "../components/dashboard/Sidebar";

const tabs = [
  { id: "shifts", label: "Manage shifts", icon: Clock3, component: ShiftsManager },
  {
    id: "assignment",
    label: "Assign shifts",
    icon: UserRoundCog,
    component: EmployeeShiftAssignment,
  },
  {
    id: "request",
    label: "Request change",
    icon: Repeat2,
    component: ShiftChangeRequest,
  },
  {
    id: "view",
    label: "Effective shift",
    icon: CalendarSearch,
    component: EffectiveShiftViewer,
  },
];

const ShiftManagement = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("shifts");
  const [collapsed, setCollapsed] = useState(false);
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const ActiveComponent = activeTabConfig.component;

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Workforce scheduling</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Shift management
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Create schedules, assign employees, and review effective shifts.
                </p>
              </div>
            </div>
          </header>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <nav
              className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2 dark:border-white/10 sm:px-4"
              aria-label="Shift management sections"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white"
                    }`}
                  >
                    {React.createElement(tab.icon, { className: "h-4 w-4" })}
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 sm:p-5 lg:p-6">
              <ActiveComponent />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ShiftManagement;

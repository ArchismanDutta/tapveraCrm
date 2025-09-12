import React, { useState } from "react";
import {
  ShiftsManager,
  EmployeeShiftAssignment,
  ShiftChangeRequest,
  EffectiveShiftViewer,
} from "../components/Shift";
import Sidebar from "../components/dashboard/Sidebar";

const ShiftManagement = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState("shifts");

  const tabs = [
    { id: "shifts", label: "Manage Shifts", component: ShiftsManager },
    {
      id: "assignment",
      label: "Assign Shifts",
      component: EmployeeShiftAssignment,
    },
    { id: "request", label: "Request Change", component: ShiftChangeRequest },
    {
      id: "view",
      label: "View Effective Shift",
      component: EffectiveShiftViewer,
    },
  ];

  const [collapsed, setCollapsed] = useState(false);

  const ActiveComponent =
    tabs.find((tab) => tab.id === activeTab)?.component || ShiftsManager;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Shift Management System
        </h1>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Active Component */}
        <div>
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
};

export default ShiftManagement;

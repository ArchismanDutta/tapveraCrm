import React, { useEffect, useState } from "react";
import axios from "axios";
import HolidayTable from "../components/manageholiday/HolidayTable";
import HolidayForm from "../components/manageholiday/HolidayForm";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const HolidayManagementPage = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/holidays`);
      setHolidays(res.data);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    } finally {
      setLoading(false);
    }
  };

  const addHoliday = async (holidayData) => {
    try {
      const res = await axios.post(`${API_BASE}/api/holidays`, holidayData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setHolidays((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Error creating holiday:", err);
    }
  };

  const updateHoliday = async (id, holidayData) => {
    try {
      const res = await axios.put(`${API_BASE}/api/holidays/${id}`, holidayData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setHolidays((prev) =>
        prev.map((h) => (h._id === id ? res.data : h))
      );
      setEditingHoliday(null);
    } catch (err) {
      console.error("Error updating holiday:", err);
    }
  };

  const deleteHoliday = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/holidays/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setHolidays((prev) => prev.filter((h) => h._id !== id));
    } catch (err) {
      console.error("Error deleting holiday:", err);
    }
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
  };

  const handleCancelEdit = () => {
    setEditingHoliday(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          sidebarCollapsed ? "ml-20" : "ml-72"
        }`}
      >
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              Holiday Management
            </h1>
            <p className="text-blue-300">
              Manage company holidays and track holiday schedules
            </p>
          </div>

          {/* Holiday Form Card */}
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-white">
                {editingHoliday ? "Edit Holiday" : "Add New Holiday"}
              </h3>
            </div>
            <HolidayForm
              onAdd={addHoliday}
              onUpdate={updateHoliday}
              editingHoliday={editingHoliday}
              onCancelEdit={handleCancelEdit}
            />
          </div>

          {/* Holiday Table Card */}
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">All Holidays</h3>
              {loading && (
                <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              )}
            </div>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-blue-300">Loading holidays...</p>
              </div>
            ) : (
              <HolidayTable
                holidays={holidays}
                onDelete={deleteHoliday}
                onEdit={handleEdit}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HolidayManagementPage;

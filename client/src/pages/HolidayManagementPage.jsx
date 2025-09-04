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

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#101c32] via-[#17233b] to-[#25355a] text-white">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main
        className={`flex-1 p-8 transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-60"
        }`}
      >
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Header */}
          <h1 className="text-4xl font-bold text-[#58a6ff] drop-shadow-lg text-center">
            Holiday Management
          </h1>

          {/* Card: Holiday Form */}
          <div className="bg-[#18253d] bg-opacity-80 p-8 rounded-xl shadow-md border border-[#243661]">
            <HolidayForm onAdd={addHoliday} />
          </div>

          {/* Card: Table */}
          <div className="bg-[#18253d] bg-opacity-80 p-8 rounded-xl shadow-md border border-[#243661]">
            {loading ? (
              <p className="text-[#82aaff] text-center">Loading holidays...</p>
            ) : (
              <HolidayTable holidays={holidays} onDelete={deleteHoliday} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HolidayManagementPage;

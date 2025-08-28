import React, { useState, useEffect } from "react";
import API from "../api"; // axios instance
import Sidebar from "../components/dashboard/Sidebar";
import NoticeForm from "../components/admintask/NoticeForm";
import NoticeList from "../components/admintask/NoticeList";

const NoticeBoard = ({ onLogout }) => {
  const [notices, setNotices] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  // Fetch notices
  const fetchNotices = async () => {
    try {
      const res = await API.get("/notices");
      setNotices(res.data);
    } catch (err) {
      console.error("Error fetching notices:", err.message);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  // Create notice (assuming form calls this)
  const handlePublish = async (message) => {
    await fetchNotices();
  };

  // Deactivate notice
  const handleDeactivate = async (id) => {
    try {
      await API.patch(`/notices/${id}/deactivate`, { isActive: false });
      fetchNotices();
    } catch (err) {
      console.error("Error deactivating notice:", err.message);
    }
  };

  // Sidebar width
  const sidebarWidth = collapsed ? 80 : 288; // Tailwind w-20=80px, w-72=288px

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-200">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onLogout={onLogout} />

      {/* Main Content */}
      <div
        className="flex-1 p-6 transition-all duration-300 overflow-y-auto"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <h1 className="text-3xl font-bold mb-6 text-gray-100">Notice Board</h1>

        {/* Create Form */}
        <div className="mb-8">
          <NoticeForm onPublish={handlePublish} />
        </div>

        {/* Notice List */}
        <NoticeList notices={notices} onDeactivate={handleDeactivate} />
      </div>
    </div>
  );
};

export default NoticeBoard;

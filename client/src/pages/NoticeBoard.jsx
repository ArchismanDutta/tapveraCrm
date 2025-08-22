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

  // Create notice
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

  return (
    <div className="flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />

      {/* Main Content */}
      <div
        className={`
          flex-1 p-6 bg-gray-50 min-h-screen transition-all duration-300
          ${collapsed ? "ml-20" : "ml-64"}
        `}
      >
        <h1 className="text-2xl font-bold mb-6">📢 Notice Board</h1>

        {/* Create Form */}
        <NoticeForm onPublish={handlePublish} />

        {/* Notice List */}
        <NoticeList notices={notices} onDeactivate={handleDeactivate} />
      </div>
    </div>
  );
};

export default NoticeBoard;

import React, { useState, useEffect } from "react";
import API from "../utils/API"; // your axios instance
import Sidebar from "../components/dashboard/Sidebar";
// import { Card, CardContent } from "@/components/ui/card";

const NoticeBoard = ({ onLogout }) => {
  const [notices, setNotices] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  // Fetch notices
  const fetchNotices = async () => {
    try {
      const res = await API.get("/"); // should return active + expired if you allow
      setNotices(res.data);
    } catch (err) {
      console.error("Error fetching notices:", err.message);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📢 Notice Board</h1>

      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="employee"
        onLogout={onLogout}
      />

      {/* Notices List */}
      <div className="space-y-4">
        {notices.length > 0 ? (
          notices.map((notice) => (
            <Card key={notice._id}>
              <CardContent className="p-4">
                <p className="text-gray-800 font-medium">{notice.message}</p>
                <p className="text-sm text-gray-400 mt-2">
                  {new Date(notice.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-gray-500">No notices available.</p>
        )}
      </div>
    </div>
  );
};

export default NoticeBoard;

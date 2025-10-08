// src/pages/NotepadPage.jsx
import React, { useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import MyNotepad from "../components/notepad/MyNotepad";

const NotepadPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  // Get user role from localStorage or context
  const getUserRole = () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.role || "employee";
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }
    return "employee";
  };

  const userRole = getUserRole();

  return (
    <div className="flex min-h-screen bg-[#0f1419] text-gray-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole}
        onLogout={onLogout}
      />

      <main
        className={`flex-1 p-6 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        <MyNotepad />
      </main>
    </div>
  );
};

export default NotepadPage;

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import IssueForm from "../components/helpcenter/IssueForm";

export default function HelpCenter({ onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  }, []);

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  const handleFormSuccess = () => {
    setFormSubmitting(false);
    setFormSuccess(true);
    // Redirect to dashboard after short delay
    setTimeout(() => navigate("/dashboard"), 2000);
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      {/* Sidebar with real logout */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        userRole={user?.role?.toLowerCase()}
      />

      {/* Main Body */}
      <main
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        } bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen flex items-start justify-center`}
      >
        <div className="w-full max-w-3xl p-6">
          <div className="bg-white rounded-xl shadow-md border p-6">
            <h1 className="text-2xl font-bold text-center text-gray-800">
              Help Center
            </h1>
            <p className="text-gray-500 text-center max-w-xl mx-auto mt-2">
              Please describe your issue in detail and attach any relevant files.
              Our support team will get back to you as soon as possible.
            </p>

            <div className="mt-8">
              {formSuccess ? (
                <div className="text-center py-4 text-green-600 font-medium">
                  ✅ Your issue has been submitted! Redirecting...
                </div>
              ) : (
                <IssueForm
                  defaultPriority="Medium"
                  onSuccess={handleFormSuccess}
                  isSubmitting={formSubmitting}
                  setIsSubmitting={setFormSubmitting}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// File: src/pages/EmployeePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import ContactInfo from "../components/employeeinfo/ContactInfo";
import PersonalInfo from "../components/employeeinfo/PersonalInfo";
import EmploymentDetails from "../components/employeeinfo/EmploymentDetails";
import SalaryCard from "../components/employeeinfo/SalaryCard";
import QualificationsSkills from "../components/employeeinfo/QualificationsSkills";
import ShiftDetails from "../components/employeeinfo/ShiftDetails";

const SIDEBAR_WIDTH = 250;
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const EmployeePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  // Fetch employee
  useEffect(() => {
    const fetchEmployee = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found. Please log in.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/users/${id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          if (res.status === 401) {
            setError("Unauthorized. Please log in again.");
            localStorage.removeItem("token");
            navigate("/login");
            return;
          } else if (res.status === 403) {
            setError("You are not authorized to view this employee.");
            return;
          } else if (res.status === 404) {
            setError("Employee not found.");
            return;
          } else {
            throw new Error("Failed to fetch employee.");
          }
        }
        const data = await res.json();

        // Convert dates for input type="date"
        const dob = data.dob ? data.dob.split("T")[0] : "";
        const doj = data.doj ? data.doj.split("T")[0] : "";

        setSelectedEmployee(data);
        setFormData({ ...data, dob, doj }); // preload form data
      } catch (err) {
        setError(err.message || "An error occurred while fetching employee data.");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, navigate]);

  // Save handler
  const handleSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to update employee");
      const updated = await res.json();

      setSelectedEmployee(updated.user); // <- fixed
      setFormData(updated.user);         // preload form again
      setIsEditing(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const pageBackground = "bg-[#11182b] min-h-screen";

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div
          style={{ marginLeft: SIDEBAR_WIDTH }}
          className={`${pageBackground} w-full flex items-center justify-center text-blue-200`}
        >
          Loading employee details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div
          style={{ marginLeft: SIDEBAR_WIDTH }}
          className={`${pageBackground} w-full flex items-center justify-center text-pink-400`}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#11182b]">
      <Sidebar />
      <main
        style={{ marginLeft: SIDEBAR_WIDTH }}
        className="w-full max-w-5xl mx-auto px-4 py-10 md:py-12 space-y-12"
      >
        {/* Header */}
        <header className="flex flex-col sm:flex-row gap-8 items-center bg-gradient-to-tr from-[#1e253b] to-[#24376b] border border-[#334065] shadow-lg rounded-2xl px-10 py-8 mb-4">
          <img
            src={
              selectedEmployee.photo ||
              selectedEmployee.avatar ||
              "https://via.placeholder.com/120"
            }
            alt={selectedEmployee.name}
            className="w-32 h-32 rounded-full border-4 border-cyan-400 bg-[#1c223a] shadow-xl object-cover"
          />
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-cyan-100 mb-1 tracking-tight flex items-center gap-3">
              👤 {selectedEmployee.name}
            </h1>
            <p className="text-cyan-300 text-lg md:text-xl font-semibold">
              {selectedEmployee.designation || selectedEmployee.jobTitle || "N/A"}
            </p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg shadow"
          >
            Edit
          </button>
        </header>

        {/* Contact & Personal Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ContactInfo
            info={{
              email: selectedEmployee.email,
              phone: selectedEmployee.contact,
              address: selectedEmployee.currentAddress,
              emergencyContact: selectedEmployee.emergencyContact,
            }}
          />
          <PersonalInfo
            info={{
              dob: selectedEmployee.dob,
              gender: selectedEmployee.gender,
              location: selectedEmployee.location,
              bloodGroup: selectedEmployee.bloodGroup,
            }}
          />
        </div>

        {/* Employment & Salary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <EmploymentDetails
            info={{
              employeeId: selectedEmployee.employeeId,
              designation: selectedEmployee.designation || selectedEmployee.jobTitle,
              department: selectedEmployee.department,
              dateOfJoining: selectedEmployee.doj || selectedEmployee.dateOfJoining,
              status: selectedEmployee.status,
              jobLevel: selectedEmployee.jobLevel,
            }}
          />
          <SalaryCard salary={selectedEmployee.salary} />
        </div>

        {/* Qualifications & Skills */}
        <QualificationsSkills
          info={{
            education: selectedEmployee.qualifications || [],
            skills: selectedEmployee.skills || [],
          }}
        />

        {/* Shift Details */}
        <ShiftDetails
          shift={selectedEmployee.shift}
          shiftType={selectedEmployee.shiftType}
        />
      </main>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1e253b] rounded-2xl p-6 w-full max-w-lg shadow-lg overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-semibold text-cyan-100 mb-4">Edit Employee</h2>
            <form onSubmit={handleSave} className="space-y-4">
              {[
                { label: "Name", key: "name", type: "text" },
                { label: "Email", key: "email", type: "email" },
                { label: "Contact", key: "contact", type: "text" },
                { label: "Designation", key: "designation", type: "text" },
                { label: "Department", key: "department", type: "text" },
                { label: "Job Level", key: "jobLevel", type: "text" },
                { label: "Status", key: "status", type: "text" },
                { label: "Blood Group", key: "bloodGroup", type: "text" },
                { label: "Location", key: "location", type: "text" },
                { label: "Date of Birth", key: "dob", type: "date" },
                { label: "Date of Joining", key: "doj", type: "date" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-cyan-300 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={formData[field.key] || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.key]: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#11182b] border border-[#334065] text-white"
                  />
                </div>
              ))}

              {/* Buttons */}
              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeePage;

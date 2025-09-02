import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";

import ContactInfo from "../components/employeeinfo/ContactInfo";
import PersonalInfo from "../components/employeeinfo/PersonalInfo";
import EmploymentDetails from "../components/employeeinfo/EmploymentDetails";
import SalaryCard from "../components/employeeinfo/SalaryCard";
import QualificationsSkills from "../components/employeeinfo/QualificationsSkills";
import ShiftDetails from "../components/employeeinfo/ShiftDetails";

const SIDEBAR_WIDTH = 250; // Adjust according to your sidebar width

const EmployeePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEmployee = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found. Please log in.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/users/${id}`, {
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
        setSelectedEmployee(data);
      } catch (err) {
        setError(err.message || "An error occurred while fetching employee data.");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, navigate]);

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
        className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8"
      >
        {/* Header */}
        <header className="flex flex-col sm:flex-row gap-6 items-center bg-[#202944] border border-[#283255] shadow-md rounded-2xl px-10 py-6">
          <img
            src={selectedEmployee.photo || selectedEmployee.avatar || "https://via.placeholder.com/120"}
            alt={selectedEmployee.name}
            className="w-28 h-28 rounded-full border-4 border-blue-400 bg-[#1c223a] shadow"
          />
          <div>
            <h1 className="text-3xl font-bold text-blue-100 mb-1">{selectedEmployee.name}</h1>
            <p className="text-blue-400 text-lg">{selectedEmployee.designation || selectedEmployee.jobTitle}</p>
          </div>
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
        <ShiftDetails shift={selectedEmployee.shift} shiftType={selectedEmployee.shiftType} />
      </main>
    </div>
  );
};

export default EmployeePage;

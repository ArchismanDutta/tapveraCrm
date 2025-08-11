// src/pages/MyProfile.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import InfoCard from "../components/profile/InfoCard";
import StatCard from "../components/profile/StatCard";
import ProfileHeader from "../components/profile/ProfileHeader";
import ActivityList from "../components/profile/ActivityList";
import axios from "axios";
import {
  FaCheckCircle,
  FaProjectDiagram,
  FaCalendarAlt,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaBirthdayCake,
} from "react-icons/fa";
import { MdWork, MdAdminPanelSettings } from "react-icons/md";

const MyProfile = ({ userType = "employee", onLogout }) => {
  const [profileData, setProfileData] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  // Fetch profile
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must be logged in to view this page.");
        return;
      }

      const res = await axios.get("/api/users/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = res.data;

      setProfileData({
        avatar: user.avatar || "https://i.pravatar.cc/150?img=32",
        name: user.name || "N/A",
        role: userType,
        team: user.team || "Not Assigned",
        contact: {
          email: user.email || "N/A",
          phone: user.contact || "N/A",
          location: user.location || "N/A",
        },
        dob: user.dob || "N/A",
        department: user.department || "N/A",
        designation: user.designation || "N/A",
        stats: {
          tasksCompleted: user.tasksCompleted || 0,
          ongoingProjects: user.ongoingProjects || 0,
          attendancePercent: user.attendancePercent || 0,
        },
        activities: user.activities || [],
        personalInfo: [
          { label: "Email", value: user.email || "N/A", icon: <FaEnvelope /> },
          { label: "Phone", value: user.contact || "N/A", icon: <FaPhone /> },
          { label: "Location", value: user.location || "N/A", icon: <FaMapMarkerAlt /> },
          { label: "DOB", value: user.dob || "N/A", icon: <FaBirthdayCake /> },
        ],
        workInfo: [
          { label: "Department", value: user.department || "N/A", icon: <MdWork /> },
          { label: "Role", value: userType, icon: <MdAdminPanelSettings /> },
          { label: "Designation", value: user.designation || "N/A", icon: <MdWork /> },
        ],
        gender: user.gender || "N/A",
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      alert("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userType]);

  // Edit
  const handleEditClick = () => {
    setEditData({
      name: profileData.name,
      phone: profileData.contact.phone,
      designation: profileData.designation,
      department: profileData.department,
      dob: profileData.dob,
      gender: profileData.gender,
    });
    setIsEditing(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        "/api/users/profile",
        {
          name: editData.name,
          contact: editData.phone,
          dob: editData.dob,
          gender: editData.gender,
          department: editData.department,
          designation: editData.designation,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchProfile();
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to update profile.");
    }
  };

  if (loading || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans text-gray-800">
      <Sidebar onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`flex-1 p-6 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"}`}>
        <ProfileHeader
          avatar={profileData.avatar}
          name={profileData.name}
          role={profileData.role}
          team={profileData.team}
          onEdit={handleEditClick}
          onMessage={() => alert("Message clicked")}
        />

        {isEditing ? (
          <div className="bg-white p-6 rounded-lg shadow mt-6 max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Profile</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              {["name", "phone", "dob", "gender", "department", "designation"].map((field) => (
                <div key={field} className="mb-4">
                  <label className="block mb-1 font-medium" htmlFor={field}>
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    id={field}
                    name={field}
                    type="text"
                    value={editData[field] || ""}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    required={field !== "gender"}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Save
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
              <StatCard value={profileData.stats.tasksCompleted} label="Tasks Completed" icon={<FaCheckCircle size={20} />} />
              <StatCard value={profileData.stats.ongoingProjects} label="Ongoing Projects" icon={<FaProjectDiagram size={20} />} />
              <StatCard value={`${profileData.stats.attendancePercent}%`} label="Attendance" icon={<FaCalendarAlt size={18} />} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <InfoCard title="Personal Information" data={profileData.personalInfo} />
              <InfoCard title="Work Information" data={profileData.workInfo} />
            </div>
            <ActivityList activities={profileData.activities} />
          </>
        )}
      </main>
    </div>
  );
};

export default MyProfile;

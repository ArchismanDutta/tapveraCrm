import React, { useEffect, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import InfoCard from "../components/profile/InfoCard";
import StatCard from "../components/profile/StatCard";
import ProfileHeader from "../components/profile/ProfileHeader";
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

const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : "N/A");

const MyProfile = ({ userType = "employee", onLogout }) => {
  const [profileData, setProfileData] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  // Fetch profile
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must be logged in to view this page.");
        return;
      }
      const res = await axios.get("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = res.data;
      setProfileData({
        avatar: user.avatar || "https://i.pravatar.cc/150?img=32",
        name: capitalize(user.name),
        role: capitalize(userType),
        team: capitalize(user.team || user.designation),
        contact: {
          email: user.email,
          phone: user.contact || "N/A",
          location: capitalize(user.location),
        },
        dob: user.dob || "N/A",
        department: capitalize(user.department),
        designation: capitalize(user.designation),
        stats: {
          tasksCompleted: user.tasksCompleted || 0,
          ongoingProjects: user.ongoingProjects || 0,
          attendancePercent: user.attendancePercent || 0,
        },
        personalInfo: [
          { label: "Email", value: user.email, icon: <FaEnvelope /> },
          { label: "Phone", value: user.contact || "N/A", icon: <FaPhone /> },
          { label: "Location", value: capitalize(user.location), icon: <FaMapMarkerAlt /> },
          { label: "DOB", value: user.dob || "N/A", icon: <FaBirthdayCake /> },
        ],
        workInfo: [
          { label: "Department", value: capitalize(user.department), icon: <MdWork /> },
          { label: "Role", value: capitalize(userType), icon: <MdAdminPanelSettings /> },
          { label: "Designation", value: capitalize(user.designation), icon: <MdWork /> },
        ],
        activities: [],
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      alert("Failed to load profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userType]);

  // Edit Handlers
  const handleEditClick = () => {
    setEditData({
      avatar: profileData.avatar,
      name: profileData.name,
      email: profileData.contact.email,
      phone: profileData.contact.phone,
      location: profileData.contact.location,
      designation: profileData.designation,
    });
    setIsEditing(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditData((prev) => ({ ...prev, avatar: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        "/api/users/me",
        {
          avatar: editData.avatar,
          name: editData.name,
          email: editData.email,
          contact: editData.phone,
          location: editData.location,
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

  const handleCancel = () => setIsEditing(false);

  if (loading || !profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100">
        <div className="text-gray-500 font-medium text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="flex bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100 min-h-screen font-sans text-gray-800">
      <Sidebar onLogout={onLogout} collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className={`flex-1 p-8 transition-all duration-300 ${collapsed ? "ml-24" : "ml-72"}`}>
        <ProfileHeader
          avatar={profileData.avatar}
          name={profileData.name}
          role={profileData.role}
          team={profileData.team}
          onEdit={handleEditClick}
        />
        {isEditing ? (
          <div className="bg-white bg-opacity-80 backdrop-blur-lg p-10 rounded-3xl shadow-2xl mx-auto mt-8 w-full max-w-2xl border border-blue-100">
            <h2 className="text-3xl font-bold mb-8 text-gray-900">Edit Profile</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-10"
            >
              {/* Avatar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-10">
                <div className="flex-shrink-0 mb-4 sm:mb-0">
                  <img
                    src={editData.avatar}
                    alt="Avatar Preview"
                    className="w-32 h-32 rounded-full object-cover border-4 border-blue-200 shadow-lg"
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-2 font-semibold text-gray-700">Profile Picture</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="w-full bg-blue-50 border border-blue-300 rounded-xl px-4 py-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-100 file:text-blue-800 hover:file:bg-blue-200"
                  />
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                {["name", "email", "phone", "location", "designation"].map((field) => (
                  <div key={field}>
                    <label className="block mb-2 font-medium text-gray-700">
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                    </label>
                    <input
                      id={field}
                      name={field}
                      type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                      value={editData[field]}
                      onChange={handleInputChange}
                      className="w-full bg-gradient-to-r from-purple-50 to-blue-100 border border-gray-200 rounded-2xl px-4 py-2 text-sm shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                      required={field !== "location"}
                    />
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-4 pt-10 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-8 py-3 rounded-2xl text-gray-700 bg-gray-100 hover:bg-gray-200 font-bold transition shadow"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 font-bold transition shadow"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mt-10">
              <StatCard
                index={0}
                value={profileData.stats.tasksCompleted}
                label="Tasks Completed"
                icon={<FaCheckCircle size={28} />}
              />
              <StatCard
                index={1}
                value={profileData.stats.ongoingProjects}
                label="Ongoing Projects"
                icon={<FaProjectDiagram size={28} />}
              />
              <StatCard
                index={2}
                value={`${profileData.stats.attendancePercent}%`}
                label="Attendance"
                icon={<FaCalendarAlt size={26} />}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-10">
              <InfoCard title="Personal Information" data={profileData.personalInfo} />
              <InfoCard title="Work Information" data={profileData.workInfo} />
            </div>
            <div className="mt-12 flex items-center justify-between">
              <div className="text-base text-gray-400">
                Last updated: <span className="font-semibold text-blue-500">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchProfile}
                  className="px-6 py-2 bg-gradient-to-r from-blue-400 to-purple-400 text-white rounded-xl text-sm hover:from-blue-500 hover:to-purple-500 font-bold transition shadow"
                >
                  Refresh
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default MyProfile;

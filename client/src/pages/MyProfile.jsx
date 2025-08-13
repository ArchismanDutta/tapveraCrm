// src/pages/MyProfile.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import InfoCard from "../components/profile/InfoCard";
import StatCard from "../components/profile/StatCard";
import ProfileHeader from "../components/profile/ProfileHeader";
import ActivityList from "../components/profile/ActivityList";
import axios from "axios";

// Icons
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
  const [editData, setEditData] = useState(null);

  // Fetch profile from backend
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must be logged in to view this page.");
        return;
      }

      const res = await axios.get("/api/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const user = res.data;
      console.log(user);

      setProfileData({
        avatar: user.avatar || "https://i.pravatar.cc/150?img=32",
        name: user.name,
        role: userType,
        team: user.team || "Not Assigned",
        contact: {
          email: user.email,
          phone: user.contact || "N/A",      // Changed to contact
          location: user.location || "N/A",  // Location optional
        },
        dob: user.dob || "N/A",
        department: user.department || "N/A",
        designation: user.designation || "N/A",
        stats: {
          tasksCompleted: user.tasksCompleted || 0,
          ongoingProjects: user.ongoingProjects || 0,
          attendancePercent: user.attendancePercent || 0,
        },
        personalInfo: [
          { label: "Email", value: user.email, icon: <FaEnvelope /> },
          { label: "Phone", value: user.contact || "N/A", icon: <FaPhone /> },
          { label: "Location", value: user.location || "N/A", icon: <FaMapMarkerAlt /> },
          { label: "DOB", value: user.dob || "N/A", icon: <FaBirthdayCake /> },
        ],
        workInfo: [
          { label: "Department", value: user.department || "N/A", icon: <MdWork /> },
          { label: "Role", value: userType, icon: <MdAdminPanelSettings /> },
          { label: "Designation", value: user.designation || "N/A", icon: <MdWork /> },
        ],
        activities: user.activities || [],
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
    setEditData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData((prev) => ({
          ...prev,
          avatar: reader.result,
        }));
      };
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
          contact: editData.phone,      // sending as contact field to backend
          location: editData.location,  // added location here as well
          designation: editData.designation,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await fetchProfile();
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to update profile.");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
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
      <Sidebar
        onLogout={onLogout}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <main
        className={`flex-1 p-6 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <ProfileHeader
          avatar={profileData.avatar}
          name={profileData.name}
          role={profileData.role}
          team={profileData.team}
          onEdit={handleEditClick}
          onMessage={() => alert("Message clicked")}
        />

        {isEditing ? (
          <div className="bg-white p-6 rounded-2xl shadow-lg mt-6 w-full max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              Edit Profile
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-6"
            >
              {/* Avatar Section */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
                <div className="flex-shrink-0">
                  <img
                    src={editData.avatar}
                    alt="Avatar Preview"
                    className="w-28 h-28 rounded-full object-cover border-4 border-gray-200 shadow-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-2 font-semibold text-gray-700">
                    Profile Picture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>

              {/* Profile Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {["name", "email", "phone", "location", "designation"].map(
                  (field) => (
                    <div key={field}>
                      <label
                        htmlFor={field}
                        className="block mb-1.5 font-medium text-gray-700"
                      >
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                      </label>
                      <input
                        id={field}
                        name={field}
                        type={
                          field === "email"
                            ? "email"
                            : field === "phone"
                            ? "tel"
                            : "text"
                        }
                        value={editData[field]}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                        required={field !== "location"}
                      />
                    </div>
                  )
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2 border rounded-lg text-gray-700 bg-gray-50 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
              <StatCard
                value={profileData.stats.tasksCompleted}
                label="Tasks Completed"
                icon={<FaCheckCircle size={20} />}
              />
              <StatCard
                value={profileData.stats.ongoingProjects}
                label="Ongoing Projects"
                icon={<FaProjectDiagram size={20} />}
              />
              <StatCard
                value={`${profileData.stats.attendancePercent}%`}
                label="Attendance"
                icon={<FaCalendarAlt size={18} />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <InfoCard
                title="Personal Information"
                data={profileData.personalInfo}
              />
              <InfoCard title="Work Information" data={profileData.workInfo} />
            </div>

            {/* <ActivityList activities={profileData.activities} /> */}

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Last updated:{" "}
                <span className="font-medium">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center">
                <button
                  onClick={fetchProfile}
                  className="px-4 py-2 bg-white border rounded-lg text-sm hover:shadow"
                >
                  Refresh
                </button>
                {/* <button
                  onClick={() => alert("Open Edit Stats modal (implement API)")}
                  className="px-4 py-2 bg-pinkAccent text-white rounded-lg text-sm hover:opacity-90"
                >
                  Edit Stats
                </button> */}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default MyProfile;

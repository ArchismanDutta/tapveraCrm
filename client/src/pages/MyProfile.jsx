// src/pages/MyProfile.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import InfoCard from "../components/profile/InfoCard";
import StatCard from "../components/profile/StatCard";
import ProfileHeader from "../components/profile/ProfileHeader";
import ActivityList from "../components/profile/ActivityList";

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

const MyProfile = ({ userType = "Employee", onLogout }) => {
  const [profileData, setProfileData] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    setTimeout(() => {
      setProfileData({
        avatar: "https://i.pravatar.cc/150?img=32",
        name: "John Doe",
        role: userType,
        team: "HR & Recruitment",
        contact: {
          email: "john.doe@example.com",
          phone: "+91 98765 43210",
          location: "Mumbai, India",
        },
        dob: "14 May 1990",
        department: "Human Resources",
        stats: {
          tasksCompleted: 128,
          ongoingProjects: 5,
          attendancePercent: 96,
        },
        personalInfo: [
          { label: "Email", value: "john.doe@example.com", icon: <FaEnvelope /> },
          { label: "Phone", value: "+91 98765 43210", icon: <FaPhone /> },
          { label: "Location", value: "Mumbai, India", icon: <FaMapMarkerAlt /> },
          { label: "DOB", value: "14 May 1990", icon: <FaBirthdayCake /> },
        ],
        workInfo: [
          { label: "Department", value: "Human Resources", icon: <MdWork /> },
          { label: "Role", value: userType, icon: <MdAdminPanelSettings /> },
        ],
        activities: [
          {
            title: "Closed Ticket #423",
            subtitle: "Resolved payroll discrepancy for client X",
            time: "Aug 07, 2025",
          },
          {
            title: "Deployed Quarterly HR Report",
            subtitle: "Shared with leadership",
            time: "Aug 04, 2025",
          },
          {
            title: "Started Project: Onboarding Automation",
            subtitle: "Initial scoping and tech meeting",
            time: "July 28, 2025",
          },
        ],
      });
      setLoading(false);
    }, 500);
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

  const handleSave = () => {
    setProfileData((prev) => ({
      ...prev,
      avatar: editData.avatar,
      name: editData.name,
      contact: {
        ...prev.contact,
        email: editData.email,
        phone: editData.phone,
        location: editData.location,
      },
      personalInfo: prev.personalInfo.map((info) => {
        if (info.label === "Email") return { ...info, value: editData.email };
        if (info.label === "Phone") return { ...info, value: editData.phone };
        if (info.label === "Location") return { ...info, value: editData.location };
        return info;
      }),
    }));
    setIsEditing(false);
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
              <div className="mb-4">
                <label className="block mb-1 font-medium">Avatar</label>
                <div className="mb-2">
                  <img
                    src={editData.avatar}
                    alt="Avatar Preview"
                    className="w-24 h-24 rounded-full object-cover border border-gray-300"
                  />
                </div>
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="w-full" />
              </div>

              {["name", "email", "phone", "location"].map((field) => (
                <div key={field} className="mb-4">
                  <label className="block mb-1 font-medium" htmlFor={field}>
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    id={field}
                    name={field}
                    type={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
                    value={editData[field]}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    required
                  />
                </div>
              ))}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={handleCancel} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100">
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

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Last updated: <span className="font-medium">Aug 07, 2025</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={fetchProfile} className="px-4 py-2 bg-white border rounded-lg text-sm hover:shadow">
                  Refresh
                </button>
                <button
                  onClick={() => alert("Open Edit Stats modal (implement API)")}
                  className="px-4 py-2 bg-pinkAccent text-white rounded-lg text-sm hover:opacity-90"
                >
                  Edit Stats
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

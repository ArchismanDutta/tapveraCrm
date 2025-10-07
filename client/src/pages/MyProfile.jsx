import React, { useEffect, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import InfoCard from "../components/profile/InfoCard";
import StatCard from "../components/profile/StatCard";
import ProfileHeader from "../components/profile/ProfileHeader";
import PayslipModal from "../components/payslip/PayslipModal";
import axios from "axios";
import newAttendanceService from "../services/newAttendanceService";

// Add fade-in animation styles
const fadeInStyle = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }
`;

import {
  FaCheckCircle,
  FaProjectDiagram,
  FaCalendarAlt,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaBirthdayCake,
  FaClock,
  FaUserTie,
  FaIdCard,
  FaCalendarCheck,
  FaAward,
  FaTrophy,
  FaChartLine,
  FaUsers,
  FaBuilding,
  FaGlobe,
  FaHistory,
  FaEdit,
  FaSync,
  FaSave,
  FaTimes,
  FaEye,
  FaShieldAlt,
  FaFileInvoiceDollar,
} from "react-icons/fa";
import {
  MdWork,
  MdAdminPanelSettings,
  MdSchedule,
  MdWorkHistory,
  MdPersonPin,
  MdSecurity,
} from "react-icons/md";

const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "N/A";

const MyProfile = ({ userType = "employee", onLogout }) => {
  const [profileData, setProfileData] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [attendanceData, setAttendanceData] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must be logged in to view this page.");
        return;
      }

      // Fetch user data
      const userRes = await axios.get(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Fetch attendance data using new system
      const now = new Date();
      const diffToMonday = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const [attendanceRes, statusRes] = await Promise.all([
        newAttendanceService.getMyWeeklySummary(monday, sunday).catch(() => ({ success: false, data: { weeklyTotals: {} } })),
        newAttendanceService.getTodayStatus().catch(() => ({ success: false, data: { attendance: {} } })),
      ]);

      const tapveraImg = "/favicon.png";
      const user = userRes.data;
      const attendance = attendanceRes.success ? attendanceRes.data.weeklyTotals : {};
      const currentStatus = (statusRes.success && statusRes.data.attendance) ? statusRes.data.attendance : {};
      // Enhanced profile data with comprehensive information
      setProfileData({
        avatar: tapveraImg,
        name: capitalize(user.name),
        role: capitalize(userType),
        team: capitalize(user.team || user.designation),
        status: currentStatus?.currentlyWorking ? "Working" : currentStatus?.onBreak ? "On Break" : "Offline",
        lastSeen: currentStatus?.lastActivity || "N/A",
        contact: {
          email: user.email,
          phone: user.contact || "N/A",
          location: capitalize(user.location),
        },
        dob: user.dob || "N/A",
        department: capitalize(user.department),
        designation: capitalize(user.designation),
        employeeId: user.employeeId || user._id?.slice(-6) || "N/A",
        joinDate: user.createdAt || user.joinDate || "N/A",
        stats: {
          tasksCompleted: user.tasksCompleted || 0,
          ongoingProjects: user.ongoingProjects || 0,
          attendancePercent: attendance.attendanceRate || user.attendancePercent || 0,
          presentDays: attendance.presentDays || 0,
          totalWorkHours: attendance.totalWorkHours || "0.0",
          onTimeRate: attendance.onTimeRate || "0%",
        },
        personalInfo: [
          {
            label: "Full Name",
            value: capitalize(user.name),
            icon: <FaUserTie className="text-cyan-400" />,
          },
          {
            label: "Employee ID",
            value: user.employeeId || user._id?.slice(-6) || "N/A",
            icon: <FaIdCard className="text-cyan-400" />,
          },
          {
            label: "Email",
            value: user.email,
            icon: <FaEnvelope className="text-cyan-400" />,
          },
          {
            label: "Phone",
            value: user.contact || "N/A",
            icon: <FaPhone className="text-cyan-400" />,
          },
          {
            label: "Location",
            value: capitalize(user.location),
            icon: <FaMapMarkerAlt className="text-cyan-400" />,
          },
          {
            label: "Date of Birth",
            value: user.dob || "N/A",
            icon: <FaBirthdayCake className="text-cyan-400" />,
          },
        ],
        workInfo: [
          {
            label: "Department",
            value: capitalize(user.department),
            icon: <FaBuilding className="text-green-400" />,
          },
          {
            label: "Designation",
            value: capitalize(user.designation),
            icon: <MdWork className="text-green-400" />,
          },
          {
            label: "Role",
            value: capitalize(userType),
            icon: <MdAdminPanelSettings className="text-green-400" />,
          },
          {
            label: "Join Date",
            value: user.createdAt || user.joinDate || "N/A",
            icon: <FaCalendarCheck className="text-green-400" />,
          },
          {
            label: "Team",
            value: capitalize(user.team || user.designation),
            icon: <FaUsers className="text-green-400" />,
          },
          {
            label: "Time Zone",
            value: user.timeZone || "UTC",
            icon: <FaGlobe className="text-green-400" />,
          },
        ],
        attendanceInfo: [
          {
            label: "Current Status",
            value: currentStatus.currentlyWorking ? "🟢 Working" : currentStatus.onBreak ? "🟡 On Break" : "🔴 Offline",
            icon: <FaClock className="text-blue-400" />,
          },
          {
            label: "Today's Hours",
            value: currentStatus.workDurationSeconds ? `${(currentStatus.workDurationSeconds / 3600).toFixed(1)}h` : "0.0h",
            icon: <MdSchedule className="text-blue-400" />,
          },
          {
            label: "This Month",
            value: `${attendance.presentDays || 0} days present`,
            icon: <FaCalendarAlt className="text-blue-400" />,
          },
          {
            label: "Attendance Rate",
            value: `${attendance.attendanceRate || 0}%`,
            icon: <FaChartLine className="text-blue-400" />,
          },
          {
            label: "On-Time Rate",
            value: attendance.onTimeRate || "0%",
            icon: <FaTrophy className="text-blue-400" />,
          },
          {
            label: "Last Activity",
            value: currentStatus.lastActivity ? new Date(currentStatus.lastActivity).toLocaleString() : "N/A",
            icon: <FaHistory className="text-blue-400" />,
          },
        ],
        activities: [],
      });

      // Set additional data
      setAttendanceData(attendance);
      setSystemInfo({
        accountType: userType,
        permissions: user.permissions || [],
        lastUpdate: new Date().toISOString(),
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
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () =>
        setEditData((prev) => ({ ...prev, avatar: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/api/users/me`,
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#141a29] via-[#181d2a] to-[#1b2233]">
        <div className="text-blue-200 font-medium text-lg">
          Loading profile...
        </div>
      </div>
    );
  }

  // Tab configuration
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "personal", label: "Personal Info" },
    { id: "work", label: "Work Details" },
    { id: "attendance", label: "Attendance" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#161c2c] rounded-xl shadow-md p-6 border border-[#232945]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">Tasks Completed</p>
                    <p className="text-3xl font-bold text-white mt-1">{profileData.stats.tasksCompleted}</p>
                  </div>
                  <FaCheckCircle className="text-4xl text-cyan-400" />
                </div>
              </div>
              <div className="bg-[#161c2c] rounded-xl shadow-md p-6 border border-[#232945]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">Attendance Rate</p>
                    <p className="text-3xl font-bold text-white mt-1">{profileData.stats.attendancePercent}%</p>
                  </div>
                  <FaChartLine className="text-4xl text-green-400" />
                </div>
              </div>
              <div className="bg-[#161c2c] rounded-xl shadow-md p-6 border border-[#232945]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">Present Days</p>
                    <p className="text-3xl font-bold text-white mt-1">{profileData.stats.presentDays}</p>
                  </div>
                  <FaCalendarCheck className="text-4xl text-purple-400" />
                </div>
              </div>
              <div className="bg-[#161c2c] rounded-xl shadow-md p-6 border border-[#232945]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">On-Time Rate</p>
                    <p className="text-3xl font-bold text-white mt-1">{profileData.stats.onTimeRate}</p>
                  </div>
                  <FaTrophy className="text-4xl text-orange-400" />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#161c2c] rounded-xl shadow-md p-6 border border-[#232945]">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowPayslipModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-green-500/25"
                >
                  <FaFileInvoiceDollar className="text-lg" />
                  View Payslip
                </button>
              </div>
            </div>

            {/* Quick Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <InfoCard title="Quick Personal Info" data={profileData.personalInfo.slice(0, 4)} />
              <InfoCard title="Quick Work Info" data={profileData.workInfo.slice(0, 4)} />
            </div>
          </div>
        );
      case "personal":
        return <InfoCard title="Personal Information" data={profileData.personalInfo} />;
      case "work":
        return <InfoCard title="Work Information" data={profileData.workInfo} />;
      case "attendance":
        return <InfoCard title="Attendance Details" data={profileData.attendanceInfo} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Inject styles */}
      <style dangerouslySetInnerHTML={{ __html: fadeInStyle }} />

      <div className="flex min-h-screen bg-[#0f1419] text-gray-100">
        <Sidebar
          onLogout={onLogout}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        <main className={`flex-1 p-8 transition-all duration-300 ${
          collapsed ? "ml-24" : "ml-72"
        }`}>
        {/* Header */}
        <h1 className="text-3xl font-bold text-white mb-6">
          My Profile
        </h1>

        {/* Profile Header Card */}
        <div className="bg-[#161c2c] rounded-xl shadow-md mb-6 p-6 border border-[#232945]">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <img
                  src={profileData.avatar}
                  alt={profileData.name}
                  className="w-20 h-20 rounded-full object-contain bg-[#0f1419] border-4 border-[#232945] shadow-lg"
                />
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#161c2c] ${
                  profileData.status === "Working" ? "bg-green-500" :
                  profileData.status === "On Break" ? "bg-yellow-500" : "bg-red-500"
                }`}></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">{profileData.name}</h1>
                <div className="flex flex-wrap items-center gap-4 text-gray-300">
                  <span className="flex items-center gap-2">
                    <MdWork className="text-cyan-400" />
                    {profileData.designation}
                  </span>
                  <span className="flex items-center gap-2">
                    <FaBuilding className="text-green-400" />
                    {profileData.department}
                  </span>
                  <span className="flex items-center gap-2">
                    <FaClock className={profileData.status === "Working" ? "text-green-400" :
                                       profileData.status === "On Break" ? "text-yellow-400" : "text-red-400"} />
                    {profileData.status}
                  </span>
                </div>
                <p className="text-gray-400 mt-2">Employee ID: {profileData.employeeId}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEditClick}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <FaEdit /> Edit Profile
              </button>
              <button
                onClick={fetchProfile}
                className="flex items-center gap-2 px-4 py-2 bg-[#232945] hover:bg-[#2c3454] text-gray-200 rounded-lg font-medium transition-colors"
              >
                <FaSync /> Refresh
              </button>
            </div>
          </div>
        </div>

        {isEditing ? (
          <div className="bg-[#161c2c] rounded-xl shadow-md p-8 mx-auto w-full max-w-2xl border border-[#232945]">
            <h2 className="text-2xl font-bold mb-6 text-white">
              Edit Profile
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-6"
            >
              {/* Avatar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
                <div className="flex-shrink-0 mb-4 sm:mb-0">
                  <img
                    src={editData.avatar}
                    alt="Avatar Preview"
                    className="w-24 h-24 rounded-full object-contain bg-[#0f1419] border-4 border-[#232945] shadow"
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-2 font-medium text-gray-300">
                    Profile Picture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="w-full bg-[#0f1419] border border-[#232945] rounded-lg px-3 py-2 text-gray-100 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#232945] file:text-cyan-400 hover:file:bg-[#2c3454]"
                  />
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {["name", "email", "phone", "location", "designation"].map(
                  (field) => (
                    <div key={field}>
                      <label className="block mb-2 font-medium text-gray-300">
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
                        className="w-full bg-[#0f1419] border border-[#232945] rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                        required={field !== "location"}
                      />
                    </div>
                  )
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-[#232945]">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 rounded-lg text-gray-300 bg-[#232945] hover:bg-[#2c3454] font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="bg-[#161c2c] rounded-xl shadow-md mb-6 border border-[#232945]">
              <div className="border-b border-[#232945]">
                <nav className="-mb-px flex space-x-8 px-6">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                        activeTab === tab.id
                          ? "border-cyan-400 text-cyan-400"
                          : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
              {renderTabContent()}
            </div>

            {/* Footer */}
            <div className="mt-8 flex items-center justify-between p-4 bg-[#161c2c] rounded-xl shadow-md border border-[#232945]">
              <div className="text-gray-400">
                <p className="text-sm">
                  Last updated: <span className="font-semibold text-cyan-400">{new Date().toLocaleDateString()}</span>
                </p>
                <p className="text-xs mt-1">
                  Member since <span className="font-semibold text-white">{new Date(profileData.joinDate).getFullYear() || "N/A"}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-500">
                  Employee ID: {profileData.employeeId}
                </div>
              </div>
            </div>
          </>
        )}
        </main>

        {/* Payslip Modal */}
        <PayslipModal
          isOpen={showPayslipModal}
          onClose={() => setShowPayslipModal(false)}
        />
      </div>
    </>
  );
};

export default MyProfile;

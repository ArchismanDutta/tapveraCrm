import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `${window.location.origin.replace(/\/$/, "")}/api` ||
  "http://localhost:5000/api";

// --- Card and Pills ---
const Card = ({ title, icon, children }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      padding: "1.5rem",
      marginBottom: "2rem",
      minHeight: 128,
      flex: "1 1 300px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
      {icon && (
        <span
          style={{ color: "#407fd5", marginRight: 10, fontSize: 22, lineHeight: 0 }}
        >
          {icon}
        </span>
      )}
      <span style={{ fontWeight: 600, color: "#1a202c", fontSize: 17 }}>{title}</span>
    </div>
    <div style={{ color: "#4b5563", fontSize: 15 }}>{children}</div>
  </section>
);

const Pill = ({ children }) => (
  <span
    style={{
      display: "inline-block",
      background: "#f3f4f6",
      color: "#1e293b",
      borderRadius: 24,
      padding: "0.32em 1.1em",
      fontWeight: 500,
      fontSize: "0.97em",
      margin: "0.2em 0.3em 0.2em 0",
    }}
  >
    {children}
  </span>
);

// --- Page ---
const EmployeePage = ({ onLogout }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const fetchEmployeeDetails = async (employeeId) => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) return navigate("/login", { replace: true });

        const res = await fetch(`${API_BASE}/users/${employeeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch employee details");

        const data = await res.json();
        setSelectedEmployee({
          _id: data._id,
          name: data.fullName || data.name || "Unnamed Employee",
          jobTitle: data.designation || "",
          department: data.department || "",
          email: data.email || "",
          contact: data.contact || "",
          manager: data.manager || "",
          employeeId: data.employeeId || "",
          dob: data.dob ? new Date(data.dob).toLocaleDateString() : "N/A",
          address: data.currentAddress || "",
          reportingTo: data.reportingTo || "",
          status: data.status || "Inactive",
          startDate: data.doj ? new Date(data.doj).toLocaleDateString() : "N/A",
          salary: {
            basic: data.salary?.basic || 0,
            total: data.salary?.total || 0,
            paymentMode: data.salary?.paymentMode || "bank",
          },
          skills: Array.isArray(data.skills) ? data.skills : [],
          qualifications: Array.isArray(data.qualifications) ? data.qualifications : [],
          recentActivity: Array.isArray(data.activity) ? data.activity : [],
          emergencyContact: data.emergencyContact || "",
          jobLevel: data.jobLevel || "",
        });
      } catch (err) {
        setSelectedEmployee(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchEmployeeDetails(id);
  }, [id, navigate]);

  if (loading) {
    return (
      <div
        style={{
          padding: "3rem",
          textAlign: "center",
          color: "#6b7280",
          fontSize: 18,
        }}
      >
        Loading employee details...
      </div>
    );
  }

  if (!selectedEmployee) {
    return (
      <div
        style={{
          padding: "3rem",
          textAlign: "center",
          color: "#6b7280",
          fontSize: 18,
        }}
      >
        Employee not found.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", background: "#f7fafc", minHeight: "100vh" }}>
      {/* Admin Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        userRole="admin"
        onLogout={onLogout}
      />

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: "0 2rem",
          marginLeft: sidebarCollapsed ? 80 : 260,
          maxWidth: 1280,
          marginTop: 0,
        }}
      >
        {/* Profile Header */}
        <div
          style={{
            background: "#e7f0fa",
            borderRadius: 16,
            padding: "2.2rem 2rem 1.7rem 2rem",
            textAlign: "center",
            marginTop: "2.5rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              width: 100,
              height: 100,
              background: "#fff",
              borderRadius: "50%",
              margin: "0 auto 1rem auto",
              border: "2.5px solid #79a5da",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Avatar placeholder */}
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 27,
              color: "#0f1436",
              marginBottom: 10,
            }}
          >
            {selectedEmployee.name}
          </div>
          <div
            style={{
              fontWeight: 500,
              fontSize: 18,
              color: "#446185",
              marginBottom: 18,
            }}
          >
            {selectedEmployee.jobTitle}
            {selectedEmployee.department ? ` - ${selectedEmployee.department}` : ""}
          </div>
          <button
            style={{
              padding: "0.57em 1.25em",
              borderRadius: 8,
              background: "#fff",
              color: "#3b7dd8",
              border: "1.5px solid #b5cef7",
              fontWeight: 500,
              fontSize: 16,
              cursor: "pointer",
              marginTop: 6,
              transition: "background 0.2s",
            }}
            onClick={() => window.open(`mailto:${selectedEmployee.email}`)}
          >
            Contact Employee
          </button>
        </div>

        {/* Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "2rem",
          }}
        >
          <Card title="Contact Information" icon="📧">
            <div>
              <strong>Work Email:</strong> {selectedEmployee.email}
            </div>
            <div>
              <strong>Work Phone:</strong> {selectedEmployee.contact}
            </div>
            <div>
              <strong>Employee ID:</strong> {selectedEmployee.employeeId || "N/A"}
            </div>
            {selectedEmployee.manager && (
              <div>
                <strong>Manager:</strong> {selectedEmployee.manager}
              </div>
            )}
          </Card>

          <Card title="Personal Details" icon="📝">
            <div>
              <strong>Date of Birth:</strong> {selectedEmployee.dob}
            </div>
            <div>
              <strong>Address:</strong> {selectedEmployee.address || "N/A"}
            </div>
            {selectedEmployee.emergencyContact && (
              <div>
                <strong>Emergency Contact:</strong> {selectedEmployee.emergencyContact}
              </div>
            )}
          </Card>

          <Card title="Employment Details" icon="🏢">
            <div>
              <strong>Department:</strong> {selectedEmployee.department}
            </div>
            <div>
              <strong>Start Date:</strong> {selectedEmployee.startDate}
            </div>
            {selectedEmployee.jobLevel && (
              <div>
                <strong>Job Level:</strong> {selectedEmployee.jobLevel}
              </div>
            )}
            {selectedEmployee.reportingTo && (
              <div>
                <strong>Reporting To:</strong> {selectedEmployee.reportingTo}
              </div>
            )}
            <div>
              <strong>Status:</strong> {selectedEmployee.status}
            </div>
          </Card>

          <Card title="Skills & Qualifications" icon="🎓">
            <div style={{ marginBottom: 10 }}>
              <strong>Skills:</strong>
              <div style={{ marginTop: 5 }}>
                {selectedEmployee.skills.length > 0 ? (
                  selectedEmployee.skills.map((skill, idx) => <Pill key={idx}>{skill}</Pill>)
                ) : (
                  <span style={{ color: "#7c899d", fontStyle: "italic", marginLeft: 8 }}>
                    N/A
                  </span>
                )}
              </div>
            </div>
            <div>
              <strong>Qualifications:</strong>
              <div style={{ marginTop: 5 }}>
                {selectedEmployee.qualifications.length > 0 ? (
                  selectedEmployee.qualifications.map((q, idx) => <div key={idx}>{q}</div>)
                ) : (
                  <span style={{ color: "#7c899d", fontStyle: "italic", marginLeft: 8 }}>
                    N/A
                  </span>
                )}
              </div>
            </div>
          </Card>

          <Card title="Recent Activity" icon="🔔">
            {selectedEmployee.recentActivity && selectedEmployee.recentActivity.length > 0 ? (
              <ul style={{ paddingLeft: 16, marginTop: 5 }}>
                {selectedEmployee.recentActivity.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: "#7c899d", fontStyle: "italic" }}>No activity recorded.</div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default EmployeePage;

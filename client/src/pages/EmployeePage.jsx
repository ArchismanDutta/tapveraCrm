import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  `${window.location.origin.replace(/\/$/, "")}/api` ||
  "http://localhost:5000/api";

// --- Card and Pills Components ---
const Card = ({ title, icon, children }) => (
  <section
    style={{
      background: "rgba(31, 41, 55, 0.9)", // dark glass
      backdropFilter: "blur(12px)",
      borderRadius: 16,
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
      padding: "1.5rem",
      marginBottom: "2rem",
      minHeight: 150,
      flex: "1 1 320px",
      color: "#cbd5e1",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 16,
        color: "#60a5fa",
        fontSize: 22,
      }}
    >
      {icon && <span style={{ marginRight: 10 }}>{icon}</span>}
      <span style={{ fontWeight: 600, fontSize: 18 }}>{title}</span>
    </div>
    <div style={{ fontSize: 15 }}>{children}</div>
  </section>
);

const Pill = ({ children }) => (
  <span
    style={{
      display: "inline-block",
      background: "rgba(96, 165, 250, 0.2)",
      color: "#60a5fa",
      borderRadius: 9999,
      padding: "0.3em 1.1em",
      fontWeight: 500,
      fontSize: "0.9em",
      margin: "0.2em 0.35em 0.2em 0",
      userSelect: "none",
    }}
  >
    {children}
  </span>
);

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
          address: data.currentAddress || "N/A",
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
          emergencyContact: data.emergencyContact || "N/A",
          jobLevel: data.jobLevel || "N/A",
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
          color: "#9ca3af",
          fontSize: 18,
          minHeight: "100vh",
          background: "#0f1523",
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
          color: "#9ca3af",
          fontSize: 18,
          minHeight: "100vh",
          background: "#0f1523",
        }}
      >
        Employee not found.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f1523" }}>
      {/* Fixed Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        userRole="admin"
        onLogout={onLogout}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: sidebarCollapsed ? 80 : 260,
          transition: "width 0.3s",
          zIndex: 1000,
        }}
      />

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: "2rem",
          marginLeft: sidebarCollapsed ? 80 : 260,
          maxWidth: `calc(100vw - ${sidebarCollapsed ? 80 : 260}px)`,
          transition: "margin-left 0.3s, max-width 0.3s",
          overflowY: "auto",
          color: "#cbd5e1",
        }}
      >
        {/* Profile Header */}
        <section
          style={{
            background: "rgba(255 255 255 / 0.05)",
            borderRadius: 16,
            padding: "2rem",
            textAlign: "center",
            marginBottom: "3rem",
            boxShadow: "0 8px 32px rgba(67, 67, 67, 0.37)",
            backdropFilter: "blur(7.6px)",
            color: "#f3f4f6",
          }}
        >
          <div
            style={{
              width: 100,
              height: 100,
              background: "#23272e",
              borderRadius: "50%",
              margin: "0 auto 1rem",
              border: "3px solid #60a5fa",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#3b82f6",
              fontSize: 48,
              fontWeight: "bold",
              textTransform: "uppercase",
            }}
            title={selectedEmployee.name}
          >
            {selectedEmployee.name.charAt(0)}
          </div>
          <h1
            style={{
              fontWeight: 700,
              fontSize: 28,
              marginBottom: 8,
              color: "#60a5fa",
            }}
          >
            {selectedEmployee.name}
          </h1>
          <p style={{ fontWeight: 500, fontSize: 18, color: "#94a3b8" }}>
            {selectedEmployee.jobTitle}
            {selectedEmployee.department ? ` - ${selectedEmployee.department}` : ""}
          </p>
          <button
            onClick={() => window.open(`mailto:${selectedEmployee.email}`)}
            style={{
              padding: "0.5em 1.25em",
              borderRadius: 8,
              background: "#2563eb",
              color: "#f3f4f6",
              fontWeight: "600",
              fontSize: 16,
              cursor: "pointer",
              marginTop: 12,
              border: "none",
              boxShadow: "0 4px 14px rgb(37 99 235 / 0.39)",
              transition: "background-color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e40af")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
          >
            Contact Employee
          </button>
        </section>

        {/* Info Grid */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "2rem",
          }}
        >
          <Card title="Contact Information" icon="📧">
            <div>
              <strong>Work Email:</strong> {selectedEmployee.email}
            </div>
            <div>
              <strong>Work Phone:</strong> {selectedEmployee.contact || "N/A"}
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
                  <span style={{ color: "#7c899d", fontStyle: "italic", marginLeft: 8 }}>N/A</span>
                )}
              </div>
            </div>
            <div>
              <strong>Qualifications:</strong>
              <div style={{ marginTop: 5 }}>
                {selectedEmployee.qualifications.length > 0 ? (
                  selectedEmployee.qualifications.map((q, idx) => <div key={idx}>{q}</div>)
                ) : (
                  <span style={{ color: "#7c899d", fontStyle: "italic", marginLeft: 8 }}>N/A</span>
                )}
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default EmployeePage;

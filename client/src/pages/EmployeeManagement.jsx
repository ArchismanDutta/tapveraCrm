import React, { useState, useEffect } from "react";
import tapveraLogo from "../assets/tapvera.png";
import EmployeeStats from "../components/employee/EmployeeStats";
import EmployeeSearch from "../components/employee/EmployeeSearch";
import EmployeeFilters from "../components/employee/EmployeeFilters";
import EmployeeActions from "../components/employee/EmployeeActions";
import EmployeeTable from "../components/employee/EmployeeTable";
import EmployeeFormModal from "../components/employee/EmployeeFormModal";
import EmployeeDetailsModal from "../components/employee/EmployeeDetailsModal";

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ department: "", designation: "", status: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    updateStats();
  }, [employees]);

  const fetchEmployees = async () => {
    // Example fetch - replace with real API or state management
    setEmployees([
      {
        id: "EMP001",
        name: "Sarah Johnson",
        department: "Engineering",
        designation: "Senior Developer",
        status: "Active",
        attendance: 95,
        salary: 85000,
        avatar: "https://randomuser.me/api/portraits/women/44.jpg",
      },
      
       {
        id: "EMP002",
        name: "Archisman Dutta",
        department: "Engineering",
        designation: "Developer",
        status: "Active",
        attendance: 95,
        salary: 85000,
        avatar: "https://randomuser.me/api/portraits/women/44.jpg",
      },

       {
        id: "EMP003",
        name: "Anish Jaiswal",
        department: "Engineering",
        designation: "Developer",
        status: "Active",
        attendance: 98,
        salary: 85000,
        avatar: "https://randomuser.me/api/portraits/women/44.jpg",
      },

       {
        id: "EMP001",
        name: "Sahil Khureshi",
        department: "Engineering",
        designation: "Senior Developer",
        status: "On Leave",
        attendance: 100,
        salary: 200000,
        avatar: "https://randomuser.me/api/portraits/women/44.jpg",
      },
    ]);
  };

  const updateStats = () => {
    const total = employees.length;
    const active = employees.filter(e => e.status === "Active").length;
    const onLeave = employees.filter(e => e.status === "On Leave").length;
    const newHires = 0; // Optionally track new hires by date added if available
    setStats({ total, active, onLeave, newHires });
  };

  const filteredEmployees = employees.filter(emp => {
    return (
      (filters.department === "" || emp.department === filters.department) &&
      (filters.designation === "" || emp.designation === filters.designation) &&
      (filters.status === "" || emp.status === filters.status) &&
      (emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       emp.id.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  // Add or Edit employee handler
  const handleAddOrEditEmployee = (employee) => {
    if (isEditing) {
      // edit existing
      setEmployees(prev => prev.map(e => (e.id === employee.id ? employee : e)));
    } else {
      // add new
      setEmployees(prev => [...prev, employee]);
    }
    setModalOpen(false);
    setSelectedEmployee(null);
    setIsEditing(false);
  };

  const handleDeleteEmployee = (id) => {
    if (window.confirm("Are you sure you want to delete this employee?")) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setIsEditing(true);
    setModalOpen(true);
  };

  const openDetailsModal = (employee) => {
    setSelectedEmployee(employee);
    setDetailsOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col items-start">
        <img src={tapveraLogo} alt="Tapvera Logo" className="h-12 w-auto" />
        <h1 className="text-2xl font-semibold text-center w-full">Employee Management</h1>
      </div>

      <EmployeeStats stats={stats} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <EmployeeSearch query={searchQuery} onSearch={setSearchQuery} />
        <div className="flex items-center gap-3">
          <EmployeeFilters filters={filters} setFilters={setFilters} />
          <EmployeeActions
            onAdd={() => setModalOpen(true)}
            onExport={() => {
              // Implement CSV/JSON export here
            }}
          />
        </div>
      </div>

      <EmployeeTable
        employees={filteredEmployees}
        onEdit={openEditModal}
        onDelete={handleDeleteEmployee}
        onViewDetails={openDetailsModal}
      />

      {modalOpen && (
        <EmployeeFormModal
          isEditing={isEditing}
          employee={selectedEmployee}
          onClose={() => {
            setModalOpen(false);
            setSelectedEmployee(null);
            setIsEditing(false);
          }}
          onSubmit={handleAddOrEditEmployee}
          existingIds={employees.map(e => e.id)}
        />
      )}

      {detailsOpen && (
        <EmployeeDetailsModal
          employee={selectedEmployee}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedEmployee(null);
          }}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;

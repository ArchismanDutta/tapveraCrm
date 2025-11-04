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
  const [regions, setRegions] = useState(['Global']);

  useEffect(() => {
    fetchEmployees();
    fetchRegions();
  }, []);

  useEffect(() => {
    updateStats();
  }, [employees]);

  const fetchRegions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/clients/regions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRegions(data);
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const fetchEmployees = () => {
    // Dummy static data; replace with your API fetch
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
        region: "Global",
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
        region: "Global",
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
        region: "Global",
      },
      {
        id: "EMP004",
        name: "Sahil Khureshi",
        department: "Engineering",
        designation: "Senior Developer",
        status: "On Leave",
        attendance: 100,
        salary: 200000,
        avatar: "https://randomuser.me/api/portraits/men/44.jpg",
        region: "Global",
      },
    ]);
  };

  const handleRegionChange = async (employeeId, newRegion) => {
    // Update locally immediately for better UX
    setEmployees((prev) =>
      prev.map((emp) => emp.id === employeeId ? { ...emp, region: newRegion } : emp)
    );

    // TODO: Add API call to update employee region in backend
    // Example:
    // try {
    //   const token = localStorage.getItem('token');
    //   await fetch(`/api/users/${employeeId}`, {
    //     method: 'PUT',
    //     headers: {
    //       'Authorization': `Bearer ${token}`,
    //       'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify({ region: newRegion })
    //   });
    // } catch (error) {
    //   console.error('Error updating region:', error);
    // }
  };

  const updateStats = () => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "Active").length;
    const onLeave = employees.filter((e) => e.status === "On Leave").length;
    setStats({ total, active, onLeave });
  };

  const filteredEmployees = employees.filter((emp) => {
    return (
      (filters.department === "" || emp.department === filters.department) &&
      (filters.designation === "" || emp.designation === filters.designation) &&
      (filters.status === "" || emp.status === filters.status) &&
      (emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const handleAddOrEditEmployee = (employee) => {
    if (isEditing) {
      setEmployees((prev) => prev.map((e) => (e.id === employee.id ? employee : e)));
    } else {
      setEmployees((prev) => [...prev, employee]);
    }
    setModalOpen(false);
    setSelectedEmployee(null);
    setIsEditing(false);
  };

  const handleDeleteEmployee = (id) => {
    if (window.confirm("Are you sure you want to delete this employee?")) {
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
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
    <div
      className="min-h-screen bg-gradient-to-tr from-[#0F141D] via-[#121923] to-[#1E2231] p-6"
      style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
    >
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center mb-8">
          <img
            src={tapveraLogo}
            alt="Tapvera"
            className="h-14 w-auto rounded-lg shadow-lg bg-white/10"
          />
          <h1 className="ml-6 text-white text-4xl font-extrabold tracking-tight drop-shadow-lg">
            Employee Management
          </h1>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#202538] rounded-2xl p-8 shadow-lg border border-[#2a2d48]">
            <h2 className="text-white text-2xl font-bold mb-4">Total Employees</h2>
            <p className="text-5xl font-extrabold text-blue-400 text-center">{stats.total ?? 0}</p>
          </div>
          <div className="bg-[#202538] rounded-2xl p-8 shadow-lg border border-[#2a2d48]">
            <h2 className="text-white text-2xl font-bold mb-4">Active Employees</h2>
            <p className="text-5xl font-extrabold text-green-400 text-center">{stats.active ?? 0}</p>
          </div>
          <div className="bg-[#202538] rounded-2xl p-8 shadow-lg border border-[#2a2d48]">
            <h2 className="text-white text-2xl font-bold mb-4">On Leave</h2>
            <p className="text-5xl font-extrabold text-amber-400 text-center">{stats.onLeave ?? 0}</p>
          </div>
        </section>

        <section className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between">
          <EmployeeSearch query={searchQuery} onSearch={setSearchQuery} />
          <div className="flex items-center gap-4">
            <EmployeeFilters filters={filters} setFilters={setFilters} />
            <EmployeeActions
              onAdd={() => setModalOpen(true)}
              onExport={() => { /* implement export if needed */ }}
            />
          </div>
        </section>

        <section className="bg-[#202538] rounded-2xl p-6 shadow-xl border border-[#2a2d48] overflow-x-auto">
          {filteredEmployees.length ? (
            <EmployeeTable
              employees={filteredEmployees}
              onEdit={openEditModal}
              onDelete={handleDeleteEmployee}
              onViewDetails={openDetailsModal}
              regions={regions}
              onRegionChange={handleRegionChange}
            />
          ) : (
            <p className="text-center text-slate-400 py-20 font-semibold  text-xl">
              No employees found.
            </p>
          )}
        </section>

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
            existingIds={employees.map((e) => e.id)}
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
    </div>
  );
};

export default EmployeeManagement;

import React, { useState, useEffect } from "react";
import { Eye, Mail, Building2, Badge, User, Crown, ChevronDown, Loader2, X, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EmployeeTable = ({ employees = [], currentUser, onStatusUpdate, updatingStatus }) => {
  const navigate = useNavigate();
  const [hoveredRow, setHoveredRow] = useState(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null);

  const handleView = (emp) => {
    if (emp && emp._id) {
      navigate(`/employee/${emp._id}`);
    }
  };

  if (!currentUser) return null;

  const sortedEmployees = [...employees].sort((a, b) => {
    if (a._id === String(currentUser._id)) return -1;
    if (b._id === String(currentUser._id)) return 1;
    return 0;
  });

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-500/20 text-green-300 border border-green-500/30';
      case 'terminated':
        return 'bg-red-500/20 text-red-300 border border-red-500/30';
      case 'absconded':
        return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <Badge className="w-3 h-3" />;
      case 'terminated':
        return <X className="w-3 h-3" />;
      case 'absconded':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Badge className="w-3 h-3" />;
    }
  };

  const handleStatusChange = (employeeId, newStatus) => {
    if (onStatusUpdate) {
      onStatusUpdate(employeeId, newStatus);
    }
    setStatusDropdownOpen(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownOpen && !event.target.closest('.status-dropdown')) {
        setStatusDropdownOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusDropdownOpen]);

  const getDepartmentIcon = (department) => {
    switch (department?.toLowerCase()) {
      case 'executives':
        return <Crown className="h-4 w-4" />;
      case 'development':
        return <Badge className="h-4 w-4" />;
      case 'humanresource':
      case 'human resource':
        return <User className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-600/30">
      {/* Table Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-slate-700/50 to-slate-800/50 sticky top-0 z-10">
            <tr className="text-gray-300">
              <th className="p-4 text-left font-semibold">Employee</th>
              <th className="p-4 text-left font-semibold">Contact</th>
              <th className="p-4 text-left font-semibold">Department</th>
              <th className="p-4 text-left font-semibold">Position</th>
              <th className="p-4 text-center font-semibold">Status</th>
              <th className="p-4 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {sortedEmployees.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 bg-slate-700/30 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-gray-500" />
                    </div>
                    <p className="text-gray-400 text-lg">No employees found</p>
                    <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedEmployees.map((emp) => {
                const isCurrentUser = emp._id === String(currentUser._id);
                const isHovered = hoveredRow === emp._id;

                return (
                  <tr
                    key={emp._id}
                    className={`transition-all duration-200 cursor-pointer ${
                      isCurrentUser
                        ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-l-4 border-cyan-400"
                        : isHovered
                        ? "bg-slate-700/20 border-l-4 border-slate-500"
                        : "hover:bg-slate-700/20 hover:border-l-4 hover:border-slate-500"
                    }`}
                    onMouseEnter={() => setHoveredRow(emp._id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => handleView(emp)}
                  >
                    {/* Employee Info */}
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 relative">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=6366f1&color=ffffff&size=40`}
                            alt={emp.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-slate-600"
                          />
                          {isCurrentUser && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-400 rounded-full flex items-center justify-center">
                              <Crown className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className={`font-semibold ${isCurrentUser ? 'text-cyan-300' : 'text-white'}`}>
                            {emp.name}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-cyan-400">(You)</span>
                            )}
                          </p>
                          <p className="text-sm text-gray-400">
                            ID: {emp.employeeId || '-'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-300">{emp.email || '-'}</span>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="text-purple-400">
                          {getDepartmentIcon(emp.department)}
                        </div>
                        <span className="text-gray-300 font-medium">
                          {emp.department || 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="p-4">
                      <span className="text-gray-300">
                        {emp.designation || 'N/A'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-4 text-center">
                      <div className="relative status-dropdown">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusDropdownOpen(statusDropdownOpen === emp._id ? null : emp._id);
                          }}
                          disabled={updatingStatus === emp._id}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105 ${getStatusColor(emp.status)} ${
                            updatingStatus === emp._id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'
                          }`}
                        >
                          {updatingStatus === emp._id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-2" />
                          ) : (
                            <span className="mr-2">
                              {getStatusIcon(emp.status)}
                            </span>
                          )}
                          {emp.status || 'active'}
                          {updatingStatus !== emp._id && (
                            <ChevronDown className="w-3 h-3 ml-1" />
                          )}
                        </button>

                        {/* Status Dropdown */}
                        {statusDropdownOpen === emp._id && (
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl z-50 min-w-[120px]">
                            {['active', 'terminated', 'absconded'].map((status) => (
                              <button
                                key={status}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(emp._id, status);
                                }}
                                className={`w-full px-3 py-2 text-left text-sm transition-colors duration-200 first:rounded-t-xl last:rounded-b-xl flex items-center gap-2 ${
                                  emp.status === status
                                    ? 'bg-cyan-500/20 text-cyan-300'
                                    : 'text-gray-300 hover:bg-slate-700/50'
                                }`}
                              >
                                {getStatusIcon(status)}
                                <span className="capitalize">{status}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(emp);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg font-medium transition-all duration-200 hover:scale-105"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Summary */}
      {sortedEmployees.length > 0 && (
        <div className="bg-slate-800/30 border-t border-slate-600/30 px-4 py-3">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>
              Showing {sortedEmployees.length} employee{sortedEmployees.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>{sortedEmployees.filter(emp => emp.status === 'active').length} Active</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span>{sortedEmployees.filter(emp => emp.status === 'terminated').length} Terminated</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                <span>{sortedEmployees.filter(emp => emp.status === 'absconded').length} Absconded</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeTable;

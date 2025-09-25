import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, UserPlus, X, Users, Building2 } from "lucide-react";

const EmployeeFilters = ({ filters, setFilters }) => {
  const navigate = useNavigate();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleClearSearch = () => {
    setFilters((f) => ({ ...f, search: "" }));
  };

  const handleClearAllFilters = () => {
    setFilters({
      search: "",
      department: "all",
      status: "all",
    });
  };

  const hasActiveFilters = filters.search || filters.department !== "all" || filters.status !== "all";

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search employees by name, email, or designation..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl pl-10 pr-12 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300"
            autoComplete="off"
          />
          {filters.search && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-400 transition-colors"
              title="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${
              showAdvancedFilters
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "bg-slate-700/50 text-gray-300 border border-slate-600/30 hover:bg-slate-600/50"
            }`}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          <button
            onClick={() => navigate("/signup", { state: { fromDirectory: true } })}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/25"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Employee</span>
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="bg-slate-800/30 border border-slate-600/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Filter className="h-5 w-5 text-cyan-400" />
              Advanced Filters
            </h3>
            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="text-sm text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-400" />
                Department
              </label>
              <select
                value={filters.department}
                onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition-all duration-300"
              >
                <option value="all">All Departments</option>
                <option value="executives">Executives</option>
                <option value="development">Development</option>
                <option value="marketingAndSales">Marketing & Sales</option>
                <option value="humanResource">Human Resource</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-green-400" />
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                className="w-full bg-slate-800/50 border border-slate-600/50 rounded-xl px-3 py-2 text-white focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all duration-300"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="terminated">Terminated</option>
                <option value="absconded">Absconded</option>
              </select>
            </div>

          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-slate-600/30">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-400">Active filters:</span>
                {filters.search && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-xs">
                    Search: "{filters.search}"
                    <button onClick={handleClearSearch} className="hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.department !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs">
                    Department: {filters.department}
                    <button onClick={() => setFilters(f => ({ ...f, department: "all" }))} className="hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {filters.status !== "all" && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 rounded-lg text-xs">
                    Status: {filters.status}
                    <button onClick={() => setFilters(f => ({ ...f, status: "all" }))} className="hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeFilters;

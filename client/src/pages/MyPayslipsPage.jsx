import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Eye,
  Calendar,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  X,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../components/dashboard/Sidebar";
import PayslipModal from "../components/payslip/PayslipModal";

const MyPayslipsPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  useEffect(() => {
    fetchMyPayslips();
  }, []);

  const fetchMyPayslips = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/api/payslips/my/history?limit=12`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPayslips(data.payslips || []);
      } else {
        toast.error("Failed to load payslips");
      }
    } catch (error) {
      console.error("Error fetching payslips:", error);
      toast.error("Failed to load payslips");
    } finally {
      setLoading(false);
    }
  };

  const handleViewPayslip = (payslip) => {
    setSelectedPayslip(payslip);
    setShowPayslipModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatMonth = (payPeriod) => {
    const [year, month] = payPeriod.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric'
    });
  };

  const getMonthShort = (payPeriod) => {
    const [year, month] = payPeriod.split('-');
    return new Date(year, month - 1).toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric'
    });
  };

  // Filter payslips by year
  const filteredPayslips = searchYear
    ? payslips.filter(p => p.payPeriod.startsWith(searchYear))
    : payslips;

  // Get unique years from payslips
  const availableYears = [...new Set(payslips.map(p => p.payPeriod.split('-')[0]))].sort((a, b) => b - a);

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onLogout={onLogout} />

      <main className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${collapsed ? "ml-20" : "ml-72"}`}>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-400" />
              My Payslips
            </h1>
            <p className="text-blue-300">
              View and download your salary payslips
            </p>
          </div>

          <button
            onClick={fetchMyPayslips}
            disabled={loading}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Filter by year:</span>
            </div>

            <select
              value={searchYear}
              onChange={(e) => setSearchYear(e.target.value)}
              className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            {searchYear && (
              <button
                onClick={() => setSearchYear("")}
                className="px-3 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-400 rounded-lg transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}

            <div className="ml-auto text-sm text-gray-400">
              Showing {filteredPayslips.length} of {payslips.length} payslips
            </div>
          </div>
        </div>

        {/* Payslips Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400">Loading payslips...</p>
            </div>
          </div>
        ) : filteredPayslips.length === 0 ? (
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-16 h-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Payslips Found</h3>
              <p className="text-gray-400">
                {searchYear
                  ? `No payslips available for ${searchYear}`
                  : "You don't have any payslips yet. They will appear here once generated."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPayslips.map((payslip) => (
              <div
                key={payslip._id}
                className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6 hover:border-blue-500/50 transition-all duration-300 hover:shadow-blue-500/10 cursor-pointer group"
                onClick={() => handleViewPayslip(payslip)}
              >
                {/* Month Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {formatMonth(payslip.payPeriod)}
                      </h3>
                      <p className="text-xs text-gray-400">
                        Generated {new Date(payslip.generatedAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Salary Info */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Gross Salary</span>
                    <span className="text-sm font-medium text-green-400">
                      {formatCurrency(payslip.grossTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Deductions</span>
                    <span className="text-sm font-medium text-red-400">
                      -{formatCurrency(payslip.totalDeductions)}
                    </span>
                  </div>
                  <div className="h-px bg-[#232945]"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-white">Net Payment</span>
                    <span className="text-lg font-bold text-blue-400">
                      {formatCurrency(payslip.netPayment)}
                    </span>
                  </div>
                </div>

                {/* Attendance Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-[#0f1419] rounded-lg p-2 border border-[#232945]">
                    <p className="text-xs text-gray-400">Working Days</p>
                    <p className="text-sm font-semibold text-white">{payslip.workingDays}</p>
                  </div>
                  <div className="bg-[#0f1419] rounded-lg p-2 border border-green-500/30">
                    <p className="text-xs text-gray-400">Paid Days</p>
                    <p className="text-sm font-semibold text-green-400">{payslip.paidDays}</p>
                  </div>
                  {(payslip.lateDays > 0 || payslip.halfDays > 0) && (
                    <>
                      {payslip.lateDays > 0 && (
                        <div className="bg-[#0f1419] rounded-lg p-2 border border-yellow-500/30">
                          <p className="text-xs text-gray-400">Late Days</p>
                          <p className="text-sm font-semibold text-yellow-400">{payslip.lateDays}</p>
                        </div>
                      )}
                      {payslip.halfDays > 0 && (
                        <div className="bg-[#0f1419] rounded-lg p-2 border border-orange-500/30">
                          <p className="text-xs text-gray-400">Half Days</p>
                          <p className="text-sm font-semibold text-orange-400">{payslip.halfDays}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* View Button */}
                <button
                  className="w-full px-4 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded-lg transition-all flex items-center justify-center gap-2 group-hover:bg-blue-600/40"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewPayslip(payslip);
                  }}
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Payslip Modal */}
        {showPayslipModal && selectedPayslip && (
          <PayslipModal
            isOpen={showPayslipModal}
            onClose={() => {
              setShowPayslipModal(false);
              setSelectedPayslip(null);
            }}
            employeeId={null} // null means current user
          />
        )}
      </main>
    </div>
  );
};

export default MyPayslipsPage;

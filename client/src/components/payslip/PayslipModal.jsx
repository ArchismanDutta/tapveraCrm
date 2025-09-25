import React, { useState, useEffect, useRef } from "react";
import {
  X,
  FileText,
  Download,
  Eye,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Building,
  CreditCard,
  Calculator,
  Printer
} from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PayslipModal = ({ isOpen, onClose, employeeId = null }) => {
  const [payslipData, setPayslipData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [isDownloading, setIsDownloading] = useState(false);
  const payslipRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  const fetchPayslip = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const endpoint = employeeId
        ? `/api/payslips/${employeeId}/${selectedMonth}`
        : `/api/payslips/my/${selectedMonth}`;

      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPayslipData(data);
      } else if (response.status === 404) {
        setPayslipData(null);
      } else {
        console.error("Failed to fetch payslip");
      }
    } catch (error) {
      console.error("Error fetching payslip:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPayslip();
    }
  }, [isOpen, selectedMonth, employeeId]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!payslipData || !payslipRef.current) return;

    setIsDownloading(true);
    try {
      // Create a completely isolated iframe for PDF generation
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '800px';
      iframe.style.height = '1200px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      // Create basic HTML structure with inline styles only
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: Arial, sans-serif;
            }
            body {
              background-color: #1e293b;
              color: #ffffff;
              padding: 24px;
              line-height: 1.5;
            }
            .payslip-container {
              background-color: #1e293b;
              border-radius: 16px;
              border: 1px solid #475569;
              overflow: hidden;
            }
            .header {
              background-color: #334155;
              padding: 24px;
              border-bottom: 1px solid #475569;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .pay-period {
              color: #9ca3af;
              font-size: 14px;
            }
            .content {
              padding: 24px;
            }
            .section {
              background-color: #334155;
              border-radius: 12px;
              border: 1px solid #475569;
              padding: 24px;
              margin-bottom: 24px;
            }
            .section-title {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 16px;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
            }
            .grid-3 {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 16px;
              text-align: center;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 14px;
            }
            .detail-label {
              color: #9ca3af;
            }
            .detail-value {
              font-weight: 500;
            }
            .earnings-section {
              background-color: #166534;
            }
            .deductions-section {
              background-color: #991b1b;
            }
            .net-salary-section {
              background-color: #1e40af;
            }
            .total-row {
              border-top: 1px solid #475569;
              padding-top: 12px;
              margin-top: 12px;
              font-weight: 600;
            }
            .earnings-total {
              color: #4ade80;
            }
            .deductions-total {
              color: #f87171;
            }
            .net-salary-amount {
              font-size: 32px;
              font-weight: bold;
              color: #60a5fa;
            }
            .net-salary-label {
              color: #9ca3af;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="payslip-container">
            <div class="header">
              <div class="company-name">TAPVERA TECHNOLOGIES</div>
              <div class="pay-period">Payslip for ${new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</div>
            </div>
            <div class="content">
              <div class="section">
                <div class="grid-2">
                  <div>
                    <div class="section-title">👤 Employee Details</div>
                    <div class="detail-row">
                      <span class="detail-label">Name:</span>
                      <span class="detail-value">${payslipData.employee?.name || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Employee ID:</span>
                      <span class="detail-value">${payslipData.employee?.employeeId || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Designation:</span>
                      <span class="detail-value">${payslipData.employee?.designation || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Department:</span>
                      <span class="detail-value">${payslipData.employee?.department || 'N/A'}</span>
                    </div>
                  </div>
                  <div>
                    <div class="section-title">📅 Pay Period</div>
                    <div class="detail-row">
                      <span class="detail-label">Pay Period:</span>
                      <span class="detail-value">${payslipData.payPeriod}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Working Days:</span>
                      <span class="detail-value">${payslipData.workingDays || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Present Days:</span>
                      <span class="detail-value">${payslipData.presentDays || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Late Days:</span>
                      <span class="detail-value">${payslipData.lateDays || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid-2">
                <div class="section earnings-section">
                  <div class="section-title">📈 Earnings</div>
                  <div class="detail-row">
                    <span class="detail-label">Basic Salary:</span>
                    <span class="detail-value">${formatCurrency(payslipData.basicSalary)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">CTC:</span>
                    <span class="detail-value">${formatCurrency(payslipData.ctc)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Gross Salary:</span>
                    <span class="detail-value">${formatCurrency(payslipData.grossSalary)}</span>
                  </div>
                  <div class="detail-row total-row earnings-total">
                    <span>Total Earnings:</span>
                    <span>${formatCurrency(payslipData.grossSalary)}</span>
                  </div>
                </div>

                <div class="section deductions-section">
                  <div class="section-title">📉 Deductions</div>
                  <div class="detail-row">
                    <span class="detail-label">PF Deduction:</span>
                    <span class="detail-value">${formatCurrency(payslipData.deductions?.pf)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">ESI Deduction:</span>
                    <span class="detail-value">${formatCurrency(payslipData.deductions?.esi)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Professional Tax:</span>
                    <span class="detail-value">${formatCurrency(payslipData.deductions?.ptax)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Late Deduction:</span>
                    <span class="detail-value">${formatCurrency(payslipData.deductions?.lateDeduction)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Other Deductions:</span>
                    <span class="detail-value">${formatCurrency(payslipData.deductions?.other)}</span>
                  </div>
                  <div class="detail-row total-row deductions-total">
                    <span>Total Deductions:</span>
                    <span>${formatCurrency(payslipData.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              <div class="section net-salary-section">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div class="section-title">💳 Net Salary</div>
                  <div style="text-align: right;">
                    <div class="net-salary-amount">${formatCurrency(payslipData.netSalary)}</div>
                    <div class="net-salary-label">Amount to be credited</div>
                  </div>
                </div>
                ${payslipData.remarks ? `
                  <div style="border-top: 1px solid #475569; margin-top: 16px; padding-top: 16px;">
                    <strong>Remarks:</strong> ${payslipData.remarks}
                  </div>
                ` : ''}
              </div>

              <div class="section">
                <div class="section-title">🧮 Calculation Summary</div>
                <div class="grid-3">
                  <div>
                    <div class="detail-label">Gross Salary</div>
                    <div style="font-weight: 600; font-size: 18px;">${formatCurrency(payslipData.grossSalary)}</div>
                  </div>
                  <div>
                    <div class="detail-label">Total Deductions</div>
                    <div style="font-weight: 600; font-size: 18px; color: #f87171;">-${formatCurrency(payslipData.totalDeductions)}</div>
                  </div>
                  <div>
                    <div class="detail-label">Net Salary</div>
                    <div style="font-weight: 600; font-size: 18px; color: #60a5fa;">${formatCurrency(payslipData.netSalary)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
      iframeDoc.close();

      // Wait for iframe to load
      await new Promise(resolve => {
        iframe.onload = resolve;
        setTimeout(resolve, 1000); // Fallback timeout
      });

      // Generate canvas from iframe
      const canvas = await html2canvas(iframe.contentDocument.body, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1e293b'
      });

      // Clean up iframe
      document.body.removeChild(iframe);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Generate filename
      const employeeName = payslipData.employee?.name?.replace(/\s+/g, '_') || 'Employee';
      const monthYear = new Date(selectedMonth + '-01').toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric'
      }).replace(' ', '_');
      const filename = `Payslip_${employeeName}_${monthYear}.pdf`;

      // Download the PDF
      pdf.save(filename);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={payslipRef} className="relative w-full max-w-4xl bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-600/30">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-600/30">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-green-400" />
              <h2 className="text-2xl font-semibold text-white">
                Payslip Details
              </h2>
            </div>
            <div className="flex items-center gap-3" data-hide-in-pdf>
              {/* Month Selector */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {payslipData && (
                <>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                    disabled={isDownloading}
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-700/50 text-white rounded-lg text-sm transition-colors"
                  >
                    {isDownloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                disabled={isDownloading}
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
                <span className="ml-3 text-gray-400">Loading payslip...</span>
              </div>
            ) : !payslipData ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">No payslip found</p>
                <p className="text-gray-500 text-sm">
                  No payslip data available for {new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Company & Employee Info */}
                <div className="bg-slate-700/30 rounded-xl p-6 border border-slate-600/30">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">TAPVERA TECHNOLOGIES</h3>
                      <p className="text-gray-400 text-sm">Payslip for {new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">Generated on:</p>
                      <p className="text-white font-medium">{formatDate(payslipData.generatedAt || new Date())}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-400" />
                        Employee Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Name:</span>
                          <span className="text-white font-medium">{payslipData.employee?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Employee ID:</span>
                          <span className="text-white font-medium">{payslipData.employee?.employeeId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Designation:</span>
                          <span className="text-white font-medium">{payslipData.employee?.designation}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Department:</span>
                          <span className="text-white font-medium">{payslipData.employee?.department}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-green-400" />
                        Pay Period
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Pay Period:</span>
                          <span className="text-white font-medium">{payslipData.payPeriod}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Working Days:</span>
                          <span className="text-white font-medium">{payslipData.workingDays || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Present Days:</span>
                          <span className="text-white font-medium">{payslipData.presentDays || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Late Days:</span>
                          <span className="text-white font-medium">{payslipData.lateDays || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Salary Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Earnings */}
                  <div className="bg-green-900/20 rounded-xl p-6 border border-green-500/30">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      Earnings
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Basic Salary:</span>
                        <span className="text-white font-medium">{formatCurrency(payslipData.basicSalary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">CTC:</span>
                        <span className="text-white font-medium">{formatCurrency(payslipData.ctc)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Gross Salary:</span>
                        <span className="text-white font-medium">{formatCurrency(payslipData.grossSalary)}</span>
                      </div>
                      <div className="border-t border-green-500/30 pt-3 mt-3">
                        <div className="flex justify-between font-semibold">
                          <span className="text-green-400">Total Earnings:</span>
                          <span className="text-green-400 text-lg">{formatCurrency(payslipData.grossSalary)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="bg-red-900/20 rounded-xl p-6 border border-red-500/30">
                    <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-red-400" />
                      Deductions
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-300">PF Deduction:</span>
                        <span className="text-white font-medium">{formatCurrency(payslipData.deductions?.pf)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">ESI Deduction:</span>
                        <span className="text-white font-medium">{formatCurrency(payslipData.deductions?.esi)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Professional Tax:</span>
                        <span className="text-white font-medium">{formatCurrency(payslipData.deductions?.ptax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Late Deduction:</span>
                        <span className="text-white font-medium">{formatCurrency(payslipData.deductions?.lateDeduction)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Other Deductions:</span>
                        <span className="text-white font-medium">{formatCurrency(payslipData.deductions?.other)}</span>
                      </div>
                      <div className="border-t border-red-500/30 pt-3 mt-3">
                        <div className="flex justify-between font-semibold">
                          <span className="text-red-400">Total Deductions:</span>
                          <span className="text-red-400 text-lg">{formatCurrency(payslipData.totalDeductions)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Salary */}
                <div className="bg-blue-900/20 rounded-xl p-6 border border-blue-500/30">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-bold text-white flex items-center gap-3">
                      <CreditCard className="w-6 h-6 text-blue-400" />
                      Net Salary
                    </h4>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-400">{formatCurrency(payslipData.netSalary)}</p>
                      <p className="text-gray-400 text-sm">Amount to be credited</p>
                    </div>
                  </div>

                  {payslipData.remarks && (
                    <div className="mt-4 pt-4 border-t border-blue-500/30">
                      <p className="text-gray-300 text-sm">
                        <strong>Remarks:</strong> {payslipData.remarks}
                      </p>
                    </div>
                  )}
                </div>

                {/* Calculation Summary */}
                <div className="bg-slate-700/30 rounded-xl p-6 border border-slate-600/30">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-purple-400" />
                    Calculation Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-400">Gross Salary</p>
                      <p className="text-white font-semibold text-lg">{formatCurrency(payslipData.grossSalary)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">Total Deductions</p>
                      <p className="text-red-400 font-semibold text-lg">-{formatCurrency(payslipData.totalDeductions)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400">Net Salary</p>
                      <p className="text-blue-400 font-semibold text-lg">{formatCurrency(payslipData.netSalary)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayslipModal;
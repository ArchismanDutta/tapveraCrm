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

  const convertToWords = (amount) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    const convertGroup = (num) => {
      if (num === 0) return '';
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convertGroup(num % 100) : '');
    };

    if (!amount || amount === 0) return 'Zero Rupees Only';

    let rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);

    let words = '';

    if (rupees >= 10000000) {
      words += convertGroup(Math.floor(rupees / 10000000)) + ' Crore ';
      rupees %= 10000000;
    }
    if (rupees >= 100000) {
      words += convertGroup(Math.floor(rupees / 100000)) + ' Lakh ';
      rupees %= 100000;
    }
    if (rupees >= 1000) {
      words += convertGroup(Math.floor(rupees / 1000)) + ' Thousand ';
      rupees %= 1000;
    }
    if (rupees > 0) {
      words += convertGroup(rupees);
    }

    words = words.trim() + ' Rupees';
    if (paise > 0) {
      words += ' and ' + convertGroup(paise) + ' Paise';
    }
    words += ' Only';

    return words;
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
              padding: 20px;
              line-height: 1.5;
            }
            .payslip-container {
              background-color: #1e293b;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              background: linear-gradient(to right, #1e3a8a, #581c87);
              padding: 32px;
              border-radius: 12px;
              border: 2px solid rgba(59, 130, 246, 0.3);
              margin-bottom: 24px;
            }
            .company-logo {
              width: 64px;
              height: 64px;
              background-color: white;
              border-radius: 8px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 16px;
            }
            .company-name {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 4px;
              letter-spacing: 0.5px;
            }
            .company-subtitle {
              color: #93c5fd;
              font-size: 14px;
              margin-bottom: 16px;
            }
            .pay-period-badge {
              display: inline-block;
              background-color: rgba(255, 255, 255, 0.1);
              padding: 8px 16px;
              border-radius: 8px;
              border: 1px solid rgba(255, 255, 255, 0.2);
              margin-top: 8px;
            }
            .pay-period-label {
              color: #93c5fd;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .pay-period-value {
              font-weight: bold;
              font-size: 18px;
            }
            .section {
              background-color: rgba(51, 65, 85, 0.3);
              border-radius: 12px;
              border: 2px solid rgba(71, 85, 105, 0.3);
              padding: 20px;
              margin-bottom: 20px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid rgba(71, 85, 105, 0.3);
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 32px;
            }
            .detail-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              margin-bottom: 8px;
              font-size: 13px;
            }
            .detail-label {
              color: #9ca3af;
              font-weight: 500;
            }
            .detail-value {
              font-weight: 600;
              text-align: right;
            }
            .earnings-table {
              width: 100%;
              border-collapse: collapse;
            }
            .earnings-table th {
              text-align: left;
              color: #9ca3af;
              font-size: 11px;
              text-transform: uppercase;
              padding-bottom: 8px;
              border-bottom: 1px solid rgba(71, 85, 105, 0.3);
            }
            .earnings-table th:last-child {
              text-align: right;
            }
            .earnings-table td {
              padding: 8px 0;
              font-size: 13px;
              border-bottom: 1px solid rgba(71, 85, 105, 0.2);
            }
            .earnings-table td:first-child {
              color: #d1d5db;
            }
            .earnings-table td:last-child {
              text-align: right;
              font-weight: 600;
            }
            .earnings-total {
              background-color: rgba(22, 101, 52, 0.1);
              border-top: 2px solid rgba(34, 197, 94, 0.3);
            }
            .earnings-total td {
              padding: 12px 0;
              color: #4ade80;
              font-weight: bold;
              font-size: 16px;
              text-transform: uppercase;
              border-bottom: none;
            }
            .deductions-total {
              background-color: rgba(153, 27, 27, 0.1);
              border-top: 2px solid rgba(239, 68, 68, 0.3);
            }
            .deductions-total td {
              padding: 12px 0;
              color: #f87171;
              font-weight: bold;
              font-size: 16px;
              text-transform: uppercase;
              border-bottom: none;
            }
            .net-payment {
              background: linear-gradient(to right, #1e40af, #1e3a8a);
              border-radius: 12px;
              padding: 24px;
              border: 2px solid rgba(96, 165, 250, 0.5);
              margin-bottom: 20px;
            }
            .net-payment-header {
              font-size: 20px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 16px;
            }
            .net-payment-box {
              background-color: rgba(255, 255, 255, 0.2);
              padding: 16px 20px;
              border-radius: 8px;
              border: 2px solid rgba(255, 255, 255, 0.3);
              text-align: center;
            }
            .net-payment-label {
              color: #93c5fd;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 4px;
            }
            .net-payment-amount {
              font-size: 36px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .net-payment-words {
              color: #93c5fd;
              font-size: 11px;
            }
            .footer {
              background-color: rgba(51, 65, 85, 0.3);
              border-radius: 12px;
              border: 1px solid rgba(71, 85, 105, 0.3);
              padding: 16px;
              font-size: 11px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="payslip-container">
            <!-- Header -->
            <div class="header">
              <div class="company-logo">T</div>
              <div class="company-name">TAPVERA TECHNOLOGIES</div>
              <div class="company-subtitle">Private Limited</div>
              <div class="pay-period-badge">
                <div class="pay-period-label">Pay Slip</div>
                <div class="pay-period-value">${new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase()}</div>
              </div>
            </div>

            <!-- Employee Info -->
            <div class="section">
              <div class="section-title">👤 Employee Information</div>
              <div class="grid-2">
                <div>
                  <div class="detail-row">
                    <span class="detail-label">Employee Name:</span>
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
                  <div class="detail-row">
                    <span class="detail-label">Pay Period:</span>
                    <span class="detail-value">${new Date(payslipData.payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Monthly CTC:</span>
                    <span class="detail-value">${formatCurrency(payslipData.monthlySalary)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Working Days:</span>
                    <span class="detail-value">${payslipData.workingDays || 'N/A'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Paid Days:</span>
                    <span class="detail-value">${payslipData.paidDays || 'N/A'}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Late Days:</span>
                    <span class="detail-value">${payslipData.lateDays || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Earnings & Deductions -->
            <div class="grid-2">
              <div class="section">
                <div class="section-title">📈 Earnings</div>
                <table class="earnings-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Basic Salary (50%)</td>
                      <td>${formatCurrency(payslipData.grossComponents?.basic)}</td>
                    </tr>
                    <tr>
                      <td>House Rent Allowance (35%)</td>
                      <td>${formatCurrency(payslipData.grossComponents?.hra)}</td>
                    </tr>
                    <tr>
                      <td>Conveyance Allowance (5%)</td>
                      <td>${formatCurrency(payslipData.grossComponents?.conveyance)}</td>
                    </tr>
                    <tr>
                      <td>Medical Allowance (5%)</td>
                      <td>${formatCurrency(payslipData.grossComponents?.medical)}</td>
                    </tr>
                    <tr>
                      <td>Special Allowance (5%)</td>
                      <td>${formatCurrency(payslipData.grossComponents?.specialAllowance)}</td>
                    </tr>
                    <tr class="earnings-total">
                      <td>Gross Earnings</td>
                      <td>${formatCurrency(payslipData.grossTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="section">
                <div class="section-title">📉 Deductions</div>
                <table class="earnings-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Provident Fund (Employee)</td>
                      <td>${formatCurrency(payslipData.deductions?.employeePF)}</td>
                    </tr>
                    <tr>
                      <td>ESI (Employee)</td>
                      <td>${formatCurrency(payslipData.deductions?.esi)}</td>
                    </tr>
                    <tr>
                      <td>Professional Tax</td>
                      <td>${formatCurrency(payslipData.deductions?.ptax)}</td>
                    </tr>
                    <tr>
                      <td>Late Attendance Deduction</td>
                      <td>${formatCurrency(payslipData.deductions?.lateDeduction)}</td>
                    </tr>
                    <tr>
                      <td>Half-Day Deduction</td>
                      <td>${formatCurrency(payslipData.deductions?.halfDayDeduction)}</td>
                    </tr>
                    ${payslipData.deductions?.tds > 0 ? `
                    <tr>
                      <td>Tax Deducted at Source (TDS)</td>
                      <td>${formatCurrency(payslipData.deductions?.tds)}</td>
                    </tr>
                    ` : ''}
                    ${payslipData.deductions?.other > 0 ? `
                    <tr>
                      <td>Other Deductions</td>
                      <td>${formatCurrency(payslipData.deductions?.other)}</td>
                    </tr>
                    ` : ''}
                    ${payslipData.deductions?.advance > 0 ? `
                    <tr>
                      <td>Advance Deduction</td>
                      <td>${formatCurrency(payslipData.deductions?.advance)}</td>
                    </tr>
                    ` : ''}
                    <tr class="deductions-total">
                      <td>Total Deductions</td>
                      <td>${formatCurrency(payslipData.totalDeductions)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Net Payment -->
            <div class="net-payment">
              <div class="net-payment-header">💳 Net Salary</div>
              <div class="net-payment-box">
                <div class="net-payment-label">Take Home</div>
                <div class="net-payment-amount">${formatCurrency(payslipData.netPayment)}</div>
                <div class="net-payment-words">In words: ${convertToWords(payslipData.netPayment)}</div>
              </div>
              ${payslipData.remarks ? `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.2); font-size: 13px;">
                  <strong>Remarks:</strong> ${payslipData.remarks}
                </div>
              ` : ''}
            </div>

            <!-- Footer -->
            <div class="footer">
              <strong>Note:</strong> This is a computer-generated payslip and does not require a signature.
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
                {/* Professional Header with Logo */}
                <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-8 border-2 border-blue-500/30 shadow-xl">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      {/* Company Logo */}
                      <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shadow-lg">
                        <div className="text-2xl font-bold text-blue-600">T</div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1 tracking-wide">TAPVERA TECHNOLOGIES</h3>
                        <p className="text-blue-200 text-sm">Private Limited</p>
                      </div>
                    </div>
                    <div className="text-right bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                      <p className="text-blue-200 text-xs uppercase tracking-wider">Pay Slip</p>
                      <p className="text-white font-bold text-lg">{new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase()}</p>
                    </div>
                  </div>
                </div>

                {/* Employee Info Card */}
                <div className="bg-slate-700/30 rounded-xl p-6 border-2 border-slate-600/30 shadow-lg">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-600/30">
                    <User className="w-5 h-5 text-blue-400" />
                    <h4 className="text-lg font-bold text-white uppercase tracking-wide">Employee Information</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Employee Name:</span>
                        <span className="text-white font-semibold">{payslipData.employee?.name || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Employee ID:</span>
                        <span className="text-white font-mono">{payslipData.employee?.employeeId || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Designation:</span>
                        <span className="text-white">{payslipData.employee?.designation || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Department:</span>
                        <span className="text-white">{payslipData.employee?.department || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Pay Period:</span>
                        <span className="text-white font-semibold">{new Date(payslipData.payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Monthly CTC:</span>
                        <span className="text-white font-semibold">{formatCurrency(payslipData.monthlySalary)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Working Days:</span>
                        <span className="text-white">{payslipData.workingDays || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Paid Days:</span>
                        <span className="text-green-400 font-semibold">{payslipData.paidDays || 'N/A'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Late Days:</span>
                        <span className="text-orange-400 font-semibold">{payslipData.lateDays || 0}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-gray-400 text-sm font-medium">Pay Date:</span>
                        <span className="text-white">{formatDate(payslipData.generatedAt || new Date())}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Earnings & Deductions Table */}
                <div className="bg-slate-800/50 rounded-xl border-2 border-slate-600/30 overflow-hidden shadow-xl">
                  <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-3 border-b-2 border-slate-600/50">
                    <h4 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      Salary Breakdown
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-slate-600/30">
                    {/* Earnings Column */}
                    <div className="p-6">
                      <h5 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Earnings
                      </h5>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-600/30">
                            <th className="text-left text-gray-400 font-semibold pb-2 uppercase text-xs">Component</th>
                            <th className="text-right text-gray-400 font-semibold pb-2 uppercase text-xs">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-600/20">
                          <tr>
                            <td className="py-2 text-gray-300">Basic Salary (50%)</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.grossComponents?.basic)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-gray-300">House Rent Allowance (35%)</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.grossComponents?.hra)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-gray-300">Conveyance Allowance (5%)</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.grossComponents?.conveyance)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-gray-300">Medical Allowance (5%)</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.grossComponents?.medical)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-gray-300">Special Allowance (5%)</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.grossComponents?.specialAllowance)}</td>
                          </tr>
                          <tr className="border-t-2 border-green-500/30 bg-green-900/10">
                            <td className="py-3 text-green-400 font-bold uppercase text-xs">Gross Earnings</td>
                            <td className="py-3 text-right text-green-400 font-bold text-lg">{formatCurrency(payslipData.grossTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Deductions Column */}
                    <div className="p-6 bg-red-900/5">
                      <h5 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Deductions
                      </h5>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-600/30">
                            <th className="text-left text-gray-400 font-semibold pb-2 uppercase text-xs">Component</th>
                            <th className="text-right text-gray-400 font-semibold pb-2 uppercase text-xs">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-600/20">
                          <tr>
                            <td className="py-2 text-gray-300">Provident Fund (Employee)</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.deductions?.employeePF)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-gray-300">ESI (Employee)</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.deductions?.esi)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-gray-300">Professional Tax</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.deductions?.ptax)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-gray-300">Late Attendance Deduction</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.deductions?.lateDeduction)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-gray-300">Half-Day Deduction</td>
                            <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.deductions?.halfDayDeduction)}</td>
                          </tr>
                          {payslipData.deductions?.tds > 0 && (
                            <tr>
                              <td className="py-2 text-gray-300">Tax Deducted at Source (TDS)</td>
                              <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.deductions?.tds)}</td>
                            </tr>
                          )}
                          {payslipData.deductions?.other > 0 && (
                            <tr>
                              <td className="py-2 text-gray-300">Other Deductions/Penalty</td>
                              <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.deductions?.other)}</td>
                            </tr>
                          )}
                          {payslipData.deductions?.advance > 0 && (
                            <tr>
                              <td className="py-2 text-gray-300">Advance Deduction</td>
                              <td className="py-2 text-right text-white font-medium">{formatCurrency(payslipData.deductions?.advance)}</td>
                            </tr>
                          )}
                          <tr className="border-t-2 border-red-500/30 bg-red-900/10">
                            <td className="py-3 text-red-400 font-bold uppercase text-xs">Total Deductions</td>
                            <td className="py-3 text-right text-red-400 font-bold text-lg">{formatCurrency(payslipData.totalDeductions)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Employer Contributions */}
                <div className="bg-indigo-900/20 rounded-xl p-6 border-2 border-indigo-500/30 shadow-lg">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-indigo-500/30">
                    <Building className="w-5 h-5 text-indigo-400" />
                    <h4 className="text-lg font-bold text-white uppercase tracking-wide">Employer Contributions</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-indigo-900/20 rounded-lg p-4 border border-indigo-500/20">
                      <p className="text-indigo-300 text-sm mb-1">Employer PF Contribution</p>
                      <p className="text-white font-bold text-xl">{formatCurrency(payslipData.employerContributions?.employerPF)}</p>
                    </div>
                    <div className="bg-indigo-900/20 rounded-lg p-4 border border-indigo-500/20">
                      <p className="text-indigo-300 text-sm mb-1">Employer ESI Contribution</p>
                      <p className="text-white font-bold text-xl">{formatCurrency(payslipData.employerContributions?.employerESI)}</p>
                    </div>
                  </div>
                </div>

                {/* Net Payment - Highlighted */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-8 border-2 border-blue-400/50 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <CreditCard className="w-7 h-7 text-white" />
                        <h4 className="text-2xl font-bold text-white uppercase tracking-wide">Net Salary</h4>
                      </div>
                      <p className="text-blue-100 text-sm">Amount payable for {new Date(payslipData.payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                      <p className="text-blue-200 text-xs mt-1">Total CTC: {formatCurrency(payslipData.ctc)} | Gross: {formatCurrency(payslipData.grossTotal)} | Deductions: {formatCurrency(payslipData.totalDeductions)}</p>
                    </div>
                    <div className="text-right bg-white/20 rounded-lg px-6 py-4 border-2 border-white/30">
                      <p className="text-blue-100 text-xs uppercase tracking-wider mb-1">Take Home</p>
                      <p className="text-4xl font-bold text-white">{formatCurrency(payslipData.netPayment)}</p>
                      <p className="text-blue-100 text-xs mt-1">In words: {convertToWords(payslipData.netPayment)}</p>
                    </div>
                  </div>

                  {payslipData.remarks && (
                    <div className="mt-4 pt-4 border-t border-white/30">
                      <p className="text-blue-100 text-sm">
                        <strong className="text-white">Remarks:</strong> {payslipData.remarks}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer with Signature */}
                <div className="bg-slate-700/30 rounded-xl p-6 border border-slate-600/30">
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-gray-400 space-y-1">
                      <p><strong className="text-gray-300">Note:</strong> This is a computer-generated payslip and does not require a signature.</p>
                      <p>Generated on: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      <p>For any queries, please contact HR at hr@tapvera.com</p>
                    </div>
                    <div className="text-right">
                      <div className="border-t-2 border-gray-400 pt-2 mt-8">
                        <p className="text-sm text-gray-300 font-semibold">Authorized Signatory</p>
                        <p className="text-xs text-gray-400">Tapvera Technologies Pvt. Ltd.</p>
                      </div>
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
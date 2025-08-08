import React from "react";
import { FileText, Plus, Eye } from "lucide-react";

const colors = {
  background: "#fff",
  border: "#ddd",
  title: "#3a3a3a",
  textPrimary: "#222",
  textSecondary: "#666",
  statusBg: "#f0f0f0",
  statusText: "#555",
  buttonText: "#fff",
  buttonGradientStart: "#f6d365", // yellow
  buttonGradientEnd: "#fda085",   // orange
  buttonHoverGradientStart: "#f5c558",
  buttonHoverGradientEnd: "#fca66d",
  actionIcon: "#666",
  actionIconHover: "#f57c00",
};

const RecentReports = ({
  reports,
  onSubmitReport,
  onViewReport,
  className,
}) => {
  const handleSubmit = () => {
    if (onSubmitReport) onSubmitReport();
    else alert("Submit report functionality will be connected to backend.");
  };

  const handleView = (report) => {
    if (onViewReport) onViewReport(report);
    else alert(`Viewing report: ${report.label}`);
  };

  return (
    <div
      className={`${className || ""} rounded-lg shadow-sm p-5`}
      style={{
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        width: "100%", // FULL WIDTH
        margin: 0,     // Remove margin for edge to edge styling in its parent
        minWidth: 0,   // Allow content to shrink on smaller screens
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2
          className="flex items-center gap-2 text-base font-semibold"
          style={{ color: colors.title }}
        >
          <FileText size={18} /> Recent Work Reports
        </h2>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
          style={{
            background: `linear-gradient(90deg, ${colors.buttonGradientStart} 0%, ${colors.buttonGradientEnd} 100%)`,
            color: colors.buttonText,
            boxShadow: "0 3px 6px rgba(253, 160, 133, 0.13)",
          }}
          onMouseEnter={e =>
            (e.currentTarget.style.background = `linear-gradient(90deg, ${colors.buttonHoverGradientStart} 0%, ${colors.buttonHoverGradientEnd} 100%)`)
          }
          onMouseLeave={e =>
            (e.currentTarget.style.background = `linear-gradient(90deg, ${colors.buttonGradientStart} 0%, ${colors.buttonGradientEnd} 100%)`)
          }
          type="button"
        >
          <Plus size={16} /> Submit Report
        </button>
      </div>

      {/* Reports List */}
      <div>
        {reports.map((report, idx) => (
          <div
            key={idx}
            onClick={() => handleView(report)}
            className="flex justify-between items-center p-3 rounded cursor-pointer transition hover:bg-gray-50 focus:bg-gray-100 focus:outline-none"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleView(report);
            }}
            style={{
              borderBottom: idx !== reports.length - 1 ? `1px solid ${colors.border}` : "none",
            }}
          >
            {/* Report Info */}
            <div style={{ maxWidth: "65%" }}>
              <p
                className="text-sm font-medium truncate"
                title={report.label}
                style={{ color: colors.textPrimary }}
              >
                {report.label}
              </p>
              <p
                className="text-xs truncate mt-0.5"
                title={report.date}
                style={{ color: colors.textSecondary }}
              >
                {report.date}
              </p>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center gap-3" style={{ minWidth: 110 }}>
              <span
                style={{
                  backgroundColor: colors.statusBg,
                  color: colors.statusText,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: 9999,
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {report.status}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleView(report);
                }}
                aria-label="View Report"
                className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors"
                style={{ color: colors.actionIcon, backgroundColor: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = colors.actionIconHover)}
                onMouseLeave={(e) => (e.currentTarget.style.color = colors.actionIcon)}
                type="button"
              >
                <Eye size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentReports;

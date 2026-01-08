const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const Project = require("../models/Project");
const PDFService = require("../services/pdfService");
const ReportDataService = require("../services/reportDataService");

// @route   GET /api/projects/:projectId/report/download
// @desc    Download complete project report as PDF
// @access  Private
router.get("/:projectId/report/download", protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check if project exists
    const project = await Project.findById(projectId).populate(
      "clients",
      "businessName clientName name email phone"
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access - employees can only access assigned projects
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Gather all report data
    const reportDataService = new ReportDataService();
    const reportData = await reportDataService.gatherProjectReportData(projectId);

    // Generate PDF using Playwright + EJS
    const pdfService = new PDFService();
    const pdfBuffer = await pdfService.generateProjectReport(reportData);

    // Generate filename
    const filename = `project-report-${project.projectName
      .replace(/\s+/g, "-")
      .toLowerCase()}-${Date.now()}.pdf`;

    // Send PDF response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}`
    );
    res.send(pdfBuffer);

  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});

module.exports = router;

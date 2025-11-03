const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const Project = require("../models/Project");
const KeywordRank = require("../models/KeywordRank");
const BlogUpdate = require("../models/BlogUpdate");
const Backlink = require("../models/Backlink");
const Screenshot = require("../models/Screenshot");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

// @route   GET /api/projects/:projectId/report/download
// @desc    Download complete project report as PDF
// @access  Private
router.get("/:projectId/report/download", protect, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Check if project exists
    const project = await Project.findById(projectId).populate(
      "client",
      "name email phone"
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access
    if (req.user.role === "employee") {
      const isAssigned = project.assignedTo.some(
        (emp) => emp.toString() === req.user._id.toString()
      );
      if (!isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // Fetch all data
    const keywords = await KeywordRank.getProjectKeywords(projectId, true);

    const blogs = await BlogUpdate.find({
      project: projectId,
      isActive: true,
    })
      .populate("addedBy", "name")
      .sort({ publishedDate: -1 });

    const backlinks = await Backlink.find({
      project: projectId,
      isActive: true,
    })
      .populate("addedBy", "name")
      .sort({ createdAt: -1 });

    const screenshots = await Screenshot.find({
      project: projectId,
      isActive: true,
    })
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });

    // Create PDF
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
    });

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=project-report-${project.projectName
        .replace(/\s+/g, "-")
        .toLowerCase()}-${Date.now()}.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Track page numbers
    let pageNumber = 1;

    // Helper function to add page footer with Tapvera branding
    const addPageFooter = () => {
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);

        // Footer background - light gray
        doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill("#f5f5f5");

        // Page number
        doc
          .fontSize(9)
          .fillColor("#666666")
          .font("Helvetica")
          .text(
            `Page ${i + 1} of ${pageCount}`,
            50,
            doc.page.height - 23,
            { align: "left" }
          );

        // Powered by Tapvera (right aligned)
        doc
          .fontSize(8)
          .fillColor("#999999")
          .font("Helvetica")
          .text(
            "Powered by ",
            0,
            doc.page.height - 23,
            { align: "right", width: doc.page.width - 85, continued: true }
          )
          .fillColor("#ff6b35")
          .font("Helvetica-Bold")
          .text("Tapvera Technologies");
      }
    };

    // Header with vibrant gradient background (red to orange to yellow)
    // Create gradient effect with multiple rectangles
    const headerHeight = 120;
    doc.rect(0, 0, doc.page.width, headerHeight).fill("#d32f2f"); // Red base
    
    // Add gradient layers
    doc.save();
    doc.rect(doc.page.width * 0.3, 0, doc.page.width * 0.7, headerHeight)
       .fillOpacity(0.9).fill("#f57c00"); // Orange
    doc.rect(doc.page.width * 0.6, 0, doc.page.width * 0.4, headerHeight)
       .fillOpacity(0.85).fill("#fbc02d"); // Yellow
    doc.restore();

    // Add Tapvera logo on white/light background
    try {
      const logoPath = path.join(__dirname, "..", "assets", "tapvera.png");
      if (fs.existsSync(logoPath)) {
        // White rounded rectangle background for logo
        doc.roundedRect(35, 25, 240, 70, 8).fill("#f5f5f5");
        // Use fit instead of fixed dimensions to maintain aspect ratio
        doc.image(logoPath, 45, 35, { fit: [220, 50], align: 'center', valign: 'center' });
      }
    } catch (error) {
      console.error("Error loading logo:", error);
      // Fallback text if logo not found
      doc.roundedRect(35, 25, 240, 70, 8).fill("#f5f5f5");
      doc.fontSize(32).fillColor("#ff6b35").font("Helvetica-Bold")
         .text("Tapvera", 55, 45);
      doc.fontSize(10).fillColor("#666666").font("Helvetica")
         .text("TECHNOLOGIES PVT. LTD.", 55, 75);
    }

    // Move down after header
    doc.y = headerHeight + 50;

    // ====================
    // PAGE 1: PROJECT INFORMATION
    // ====================
    doc
      .fontSize(22)
      .fillColor("#333333")
      .font("Helvetica-Bold")
      .text("PROJECT OVERVIEW", { align: "center" });

    doc.moveDown(2);

    // Project info in a box
    const infoBoxTop = doc.y;
    doc.roundedRect(50, infoBoxTop, 495, 200, 8).fillAndStroke("#f9fafb", "#e5e7eb");

    doc.y = infoBoxTop + 20;

    doc
      .fontSize(12)
      .fillColor("#ff6b35")
      .font("Helvetica-Bold")
      .text("Client Information", 70, doc.y);

    doc.moveDown(0.5);

    doc
      .fontSize(11)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text("Client: ", 70, doc.y, { continued: true })
      .font("Helvetica")
      .text(project.client?.name || "N/A");

    if (project.client?.email) {
      doc
        .font("Helvetica-Bold")
        .text("Email: ", 70, doc.y, { continued: true })
        .font("Helvetica")
        .text(project.client.email);
    }

    doc.moveDown(1);

    doc
      .fontSize(12)
      .fillColor("#ff6b35")
      .font("Helvetica-Bold")
      .text("Project Details", 70, doc.y);

    doc.moveDown(0.5);

    doc
      .fontSize(11)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text("Type: ", 70, doc.y, { continued: true })
      .font("Helvetica")
      .text(project.type?.join(", ") || "N/A");

    doc
      .font("Helvetica-Bold")
      .text("Status: ", 70, doc.y, { continued: true })
      .font("Helvetica")
      .text(project.status?.toUpperCase() || "N/A");

    doc
      .font("Helvetica-Bold")
      .text("Start Date: ", 70, doc.y, { continued: true })
      .font("Helvetica")
      .text(
        project.startDate
          ? new Date(project.startDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric"
            })
          : "N/A"
      );

    doc
      .font("Helvetica-Bold")
      .text("End Date: ", 70, doc.y, { continued: true })
      .font("Helvetica")
      .text(
        project.endDate
          ? new Date(project.endDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric"
            })
          : "N/A"
      );

    if (project.description) {
      doc.moveDown(1);
      doc
        .fontSize(12)
        .fillColor("#ff6b35")
        .font("Helvetica-Bold")
        .text("Description", 70, doc.y);

      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor("#4b5563")
        .font("Helvetica")
        .text(project.description, 70, doc.y, { width: 455, align: "justify" });
    }

    // ====================
    // PAGE 2: KEYWORD ANALYSIS SECTION
    // ====================
    doc.addPage();
    doc
      .fontSize(22)
      .fillColor("#333333")
      .font("Helvetica-Bold")
      .text("KEYWORD ANALYSIS");

    // Underline
    doc.moveTo(50, doc.y + 5).lineTo(280, doc.y + 5)
       .strokeColor("#ff6b35").lineWidth(3).stroke();

    doc.moveDown(2);

    if (keywords.length === 0) {
      doc
        .fontSize(11)
        .fillColor("#666666")
        .font("Helvetica-Oblique")
        .text("No keywords tracked for this project.");
    } else {
      // Keyword Stats
      const improvedKeywords = keywords.filter(
        (k) => k.rankTrend === "improved"
      ).length;
      const declinedKeywords = keywords.filter(
        (k) => k.rankTrend === "declined"
      ).length;

      doc.fontSize(12).fillColor("#000000").font("Helvetica-Bold");
      doc.text(`Total Keywords: ${keywords.length}`);
      doc.fillColor("#10b981").text(`Improved: ${improvedKeywords}`);
      doc.fillColor("#ef4444").text(`Declined: ${declinedKeywords}`);
      doc.moveDown(1);

      // Keywords Table
      const tableTop = doc.y;
      const colWidths = [180, 70, 70, 70, 100];
      const headers = [
        "Keyword",
        "Past Rank",
        "Previous",
        "Current",
        "Trend",
      ];

      // Table Header Background with gradient
      doc.rect(50, tableTop, 495, 30).fill("#ff6b35");

      // Table Header Text
      doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");

      let xPos = 55;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop + 10, {
          width: colWidths[i] - 10,
          align: i === 0 ? "left" : "center",
        });
        xPos += colWidths[i];
      });

      let yPos = tableTop + 30;

      // Table Rows
      keywords.forEach((keyword, index) => {
        if (yPos > 720) {
          doc.addPage();
          yPos = 50;

          // Redraw header on new page
          doc.rect(50, yPos, 495, 30).fill("#ff6b35");
          doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");

          let xPosHeader = 55;
          headers.forEach((header, i) => {
            doc.text(header, xPosHeader, yPos + 10, {
              width: colWidths[i] - 10,
              align: i === 0 ? "left" : "center",
            });
            xPosHeader += colWidths[i];
          });
          yPos += 30;
        }

        const bgColor = index % 2 === 0 ? "#f3f4f6" : "#ffffff";
        const rowHeight = 28;

        // Row background
        doc.rect(50, yPos, 495, rowHeight).fill(bgColor);

        // Border lines for better separation
        doc.strokeColor("#e5e7eb").lineWidth(0.5);
        doc.rect(50, yPos, 495, rowHeight).stroke();

        doc.fontSize(9).fillColor("#111827").font("Helvetica");

        // Keyword column
        doc.text(keyword.keyword || "N/A", 55, yPos + 10, {
          width: colWidths[0] - 10,
          ellipsis: true,
        });

        // Past Rank column
        doc.fillColor("#4b5563").text(
          keyword.pastRank?.rank?.toString() || "-",
          55 + colWidths[0],
          yPos + 10,
          { width: colWidths[1] - 10, align: "center" }
        );

        // Previous Rank column
        doc.fillColor("#4b5563").text(
          keyword.previousRank?.rank?.toString() || "-",
          55 + colWidths[0] + colWidths[1],
          yPos + 10,
          { width: colWidths[2] - 10, align: "center" }
        );

        // Current Rank column - bold and darker
        doc.fillColor("#111827").font("Helvetica-Bold").text(
          keyword.currentRank?.rank?.toString() || "-",
          55 + colWidths[0] + colWidths[1] + colWidths[2],
          yPos + 10,
          { width: colWidths[3] - 10, align: "center" }
        );

        // Trend column with color
        const trendColor =
          keyword.rankTrend === "improved"
            ? "#059669"
            : keyword.rankTrend === "declined"
            ? "#dc2626"
            : "#6b7280";

        const trendSymbol =
          keyword.rankTrend === "improved"
            ? "↑"
            : keyword.rankTrend === "declined"
            ? "↓"
            : "−";

        const trendText =
          keyword.rankTrend === "improved"
            ? "Improved"
            : keyword.rankTrend === "declined"
            ? "Declined"
            : "No Change";

        doc.fillColor(trendColor).font("Helvetica-Bold").text(
          `${trendSymbol} ${trendText}`,
          55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          yPos + 10,
          { width: colWidths[4] - 10, align: "center" }
        );

        yPos += rowHeight;
      });

    }

    // ====================
    // PAGE 3: BLOG UPDATES SECTION
    // ====================
    doc.addPage();
    doc
      .fontSize(22)
      .fillColor("#333333")
      .font("Helvetica-Bold")
      .text("BLOG UPDATES");

    // Underline
    doc.moveTo(50, doc.y + 5).lineTo(250, doc.y + 5)
       .strokeColor("#ff6b35").lineWidth(3).stroke();

    doc.moveDown(2);

    if (blogs.length === 0) {
      doc
        .fontSize(11)
        .fillColor("#666666")
        .font("Helvetica-Oblique")
        .text("No blog updates for this project.");
    } else {
      doc
        .fontSize(12)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text(`Total Blog Posts: ${blogs.length}`);
      doc.moveDown(1);

      blogs.forEach((blog, index) => {
        if (doc.y > 650) {
          doc.addPage();
        }

        // Blog card with background
        const cardTop = doc.y;
        const cardHeight = 85;

        doc.rect(50, cardTop, 495, cardHeight).fillAndStroke("#f9fafb", "#e5e7eb");

        doc
          .fontSize(11)
          .fillColor("#1e3a8a")
          .font("Helvetica-Bold")
          .text(`${index + 1}. ${blog.title}`, 60, cardTop + 10, {
            width: 475,
          });

        doc
          .fontSize(9)
          .fillColor("#6b7280")
          .font("Helvetica")
          .text(
            `Published: ${
              blog.publishedDate
                ? new Date(blog.publishedDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "N/A"
            }`,
            60,
            cardTop + 28
          );

        if (blog.url) {
          doc
            .fontSize(8)
            .fillColor("#2563eb")
            .text(blog.url, 60, cardTop + 43, {
              link: blog.url,
              width: 475,
              ellipsis: true,
              underline: true,
            });
        }

        if (blog.addedBy?.name) {
          doc
            .fontSize(8)
            .fillColor("#9ca3af")
            .font("Helvetica-Oblique")
            .text(`Added by: ${blog.addedBy.name}`, 60, cardTop + 60);
        }

        doc.y = cardTop + cardHeight + 10;
      });
    }

    // ====================
    // PAGE 4: OFF-PAGE SEO (BACKLINKS) SECTION
    // ====================
    doc.addPage();
    doc
      .fontSize(22)
      .fillColor("#333333")
      .font("Helvetica-Bold")
      .text("OFF-PAGE SEO");

    // Underline
    doc.moveTo(50, doc.y + 5).lineTo(250, doc.y + 5)
       .strokeColor("#ff6b35").lineWidth(3).stroke();

    doc.moveDown(2);

    if (backlinks.length === 0) {
      doc
        .fontSize(11)
        .fillColor("#666666")
        .font("Helvetica-Oblique")
        .text("No backlinks tracked for this project.");
    } else {
      const socialMediaLinks = backlinks.filter(
        (b) => b.category === "Social Media"
      ).length;
      const otherLinks = backlinks.filter((b) => b.category === "Others").length;

      doc.fontSize(12).fillColor("#000000").font("Helvetica-Bold");
      doc.text(`Total Backlinks: ${backlinks.length}`);
      doc.text(`Social Media: ${socialMediaLinks}`);
      doc.text(`Others: ${otherLinks}`);
      doc.moveDown(1);

      backlinks.forEach((backlink, index) => {
        if (doc.y > 680) {
          doc.addPage();
        }

        const cardTop = doc.y;
        const cardHeight = backlink.notes ? 70 : 55;

        // Backlink card
        doc.rect(50, cardTop, 495, cardHeight).fillAndStroke("#f9fafb", "#e5e7eb");

        const categoryColor =
          backlink.category === "Social Media" ? "#9333ea" : "#2563eb";

        // Platform/Title
        doc.fontSize(10).fillColor(categoryColor).font("Helvetica-Bold");
        const title = backlink.platform
          ? `${index + 1}. ${backlink.platform}`
          : `${index + 1}. Backlink`;
        doc.text(title, 60, cardTop + 10);

        // URL
        doc
          .fontSize(8)
          .fillColor("#2563eb")
          .font("Helvetica")
          .text(backlink.url, 60, cardTop + 26, {
            link: backlink.url,
            underline: true,
            width: 475,
            ellipsis: true,
          });

        // Category badge
        const badgeX = 60;
        const badgeY = cardTop + 38;
        const badgeColor = backlink.category === "Social Media" ? "#9333ea" : "#2563eb";

        doc.roundedRect(badgeX, badgeY, 90, 14, 3).fillAndStroke(badgeColor, badgeColor);
        doc
          .fontSize(7)
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .text(backlink.category, badgeX + 5, badgeY + 4);

        // Date
        doc
          .fontSize(8)
          .fillColor("#6b7280")
          .font("Helvetica")
          .text(
            new Date(backlink.createdAt).toLocaleDateString(),
            160,
            badgeY + 2
          );

        // Notes if present
        if (backlink.notes) {
          doc
            .fontSize(8)
            .fillColor("#4b5563")
            .font("Helvetica-Oblique")
            .text(`"${backlink.notes}"`, 60, cardTop + 56, {
              width: 475,
              ellipsis: true,
            });
        }

        doc.y = cardTop + cardHeight + 8;
      });
    }

    // ====================
    // PAGE 5+: SCREENSHOTS SECTION
    // ====================
    doc.addPage();
    doc
      .fontSize(22)
      .fillColor("#333333")
      .font("Helvetica-Bold")
      .text("SCREENSHOTS");

    // Underline
    doc.moveTo(50, doc.y + 5).lineTo(230, doc.y + 5)
       .strokeColor("#ff6b35").lineWidth(3).stroke();

    doc.moveDown(2);

    if (screenshots.length === 0) {
      doc
        .fontSize(11)
        .fillColor("#666666")
        .font("Helvetica-Oblique")
        .text("No screenshots uploaded for this project.");
    } else {
      doc
        .fontSize(12)
        .fillColor("#000000")
        .font("Helvetica-Bold")
        .text(`Total Screenshots: ${screenshots.length}`);
      doc.moveDown(1);

      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];

        // Check if we need a new page
        if (doc.y > 250) {
          doc.addPage();
        }

        // Screenshot info box
        const infoBoxTop = doc.y;
        doc.rect(50, infoBoxTop, 495, 60).fillAndStroke("#f9fafb", "#e5e7eb");

        doc
          .fontSize(11)
          .fillColor("#1e3a8a")
          .font("Helvetica-Bold")
          .text(`${i + 1}. ${screenshot.title || "Screenshot"}`, 60, infoBoxTop + 10, {
            width: 475,
          });

        if (screenshot.description) {
          doc
            .fontSize(9)
            .fillColor("#4b5563")
            .font("Helvetica")
            .text(screenshot.description, 60, infoBoxTop + 28, {
              width: 475,
              ellipsis: true,
            });
        }

        const metaY = screenshot.description ? infoBoxTop + 45 : infoBoxTop + 28;
        doc
          .fontSize(8)
          .fillColor("#6b7280")
          .font("Helvetica")
          .text(
            `Uploaded: ${new Date(screenshot.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}`,
            60,
            metaY
          );

        if (screenshot.uploadedBy?.name) {
          doc
            .fillColor("#6b7280")
            .text(` | By: ${screenshot.uploadedBy.name}`, { continued: false });
        }

        doc.y = infoBoxTop + 65;

        // Try to embed the screenshot image
        try {
          const imagePath = path.join(__dirname, "..", screenshot.imageUrl);
          if (fs.existsSync(imagePath)) {
            // Calculate image dimensions to fit on page
            const maxWidth = 480;
            const maxHeight = 350;

            // Add border around image
            const imgY = doc.y;
            doc.image(imagePath, 55, imgY, {
              fit: [maxWidth, maxHeight],
              align: "center",
            });

            // Draw border
            doc.strokeColor("#d1d5db").lineWidth(1);
            doc.rect(54, imgY - 1, maxWidth + 2, maxHeight + 2).stroke();

            doc.moveDown(18);
          } else {
            doc
              .fontSize(9)
              .fillColor("#9ca3af")
              .font("Helvetica-Oblique")
              .text("[Image file not found on server]", 60, doc.y + 5);
            doc.moveDown(2);
          }
        } catch (error) {
          console.error("Error embedding image:", error);
          doc
            .fontSize(9)
            .fillColor("#9ca3af")
            .font("Helvetica-Oblique")
            .text("[Image could not be loaded]", 60, doc.y + 5);
          doc.moveDown(2);
        }
      }
    }

    // Add footer with page numbers
    addPageFooter();

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
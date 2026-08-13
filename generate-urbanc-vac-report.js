// Generate PDF Report for Urbanc Vac Project
// Resolve dependencies from server/node_modules
const path = require("path");
module.paths.unshift(path.join(__dirname, "server", "node_modules"));

require("dotenv").config({ path: path.join(__dirname, "server", ".env") });
const mongoose = require("mongoose");
const Project = require("./server/models/Project");
// Register models needed for populate() calls
require("./server/models/Client");
require("./server/models/User");
const ReportDataService = require("./server/services/reportDataService");
const PDFService = require("./server/services/pdfService");
const fs = require("fs");

async function generateUrbancVacReport() {
  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find Urbanc Vac project
    console.log("\nSearching for Urbanc Vac project...");
    const project = await Project.findOne({
      projectName: { $regex: /urbanvac/i }
    });

    if (!project) {
      console.error("❌ Urbanc Vac project not found!");
      console.log("\nLet's check all projects:");
      const allProjects = await Project.find({}).select('projectName');
      console.log("Available projects:", allProjects.map(p => p.projectName));
      process.exit(1);
    }

    console.log(`✅ Found project: ${project.projectName}`);
    console.log(`   Project ID: ${project._id}`);

    // Gather report data
    console.log("\n📊 Gathering report data...");
    const reportDataService = new ReportDataService();
    const reportData = await reportDataService.gatherProjectReportData(project._id);

    console.log(`   ✅ Keywords: ${reportData.keywords?.length || 0}`);
    console.log(`   ✅ Blogs: ${reportData.blogs?.length || 0}`);
    console.log(`   ✅ Backlinks: ${reportData.backlinks?.length || 0}`);
    console.log(`   ✅ Screenshots: ${reportData.screenshots?.length || 0}`);

    // Generate PDF
    console.log("\n📄 Generating PDF...");
    const pdfService = new PDFService();
    const pdfBuffer = await pdfService.generateProjectReport(reportData);

    // Save PDF to file
    const filename = `urbanc-vac-report-${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, filename);
    fs.writeFileSync(outputPath, pdfBuffer);

    console.log(`\n✅ PDF generated successfully!`);
    console.log(`   📁 File: ${outputPath}`);
    console.log(`   📏 Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // Cleanup
    await pdfService.cleanup();
    await mongoose.connection.close();
    console.log("\n✅ Done!");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
generateUrbancVacReport();

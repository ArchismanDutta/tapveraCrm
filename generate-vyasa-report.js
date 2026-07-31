// Generate PDF Report for Vyasa IAS Project
require("dotenv").config();
const mongoose = require("mongoose");
const Project = require("./server/models/Project");
const ReportDataService = require("./server/services/reportDataService");
const PDFService = require("./server/services/pdfService");
const fs = require("fs");
const path = require("path");

async function generateVyasaReport() {
  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find Vyasa IAS project
    console.log("\nSearching for Vyasa IAS project...");
    const project = await Project.findOne({
      projectName: { $regex: /vyasa/i }
    });

    if (!project) {
      console.error("❌ Vyasa IAS project not found!");
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
    const filename = `vyasa-ias-report-${Date.now()}.pdf`;
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
generateVyasaReport();

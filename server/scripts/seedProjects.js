const mongoose = require("mongoose");
const Project = require("../models/Project");
const User = require("../models/User");
const Client = require("../models/Client");
require("dotenv").config();

const seedProjects = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Get some users and clients
    const employees = await User.find({ role: "employee" }).limit(5);
    const clients = await Client.find({ status: "Active" }).limit(3);
    const admin = await User.findOne({ role: "superadmin" });

    if (!employees.length || !clients.length || !admin) {
      console.log("Please create employees, clients, and admin first");
      process.exit(1);
    }

    const projectTypes = ["Website", "SEO", "Google Marketing", "SMO", "Hosting", "Invoice App"];
    const priorities = ["Low", "Medium", "High"];
    const statuses = ["Active", "Inactive", "Completed"];

    const projects = [];

    for (let i = 0; i < 20; i++) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 90));

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 180) + 30);

      projects.push({
        projectName: `Project ${i + 1} - ${projectTypes[Math.floor(Math.random() * projectTypes.length)]}`,
        type: [projectTypes[Math.floor(Math.random() * projectTypes.length)]],
        assignedTo: employees.slice(0, Math.floor(Math.random() * 3) + 1).map(e => e._id),
        clients: [clients[Math.floor(Math.random() * clients.length)]._id],
        startDate,
        endDate,
        description: `Description for project ${i + 1}`,
        budget: Math.floor(Math.random() * 50000) + 5000,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        createdBy: admin._id,
      });
    }

    await Project.deleteMany({});
    await Project.insertMany(projects);

    console.log("✅ Projects seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding projects:", error);
    process.exit(1);
  }
};

seedProjects();

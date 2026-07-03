// scripts/seedDatabase.js
// Comprehensive database seeding script for TapveraCRM
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import Models
const User = require("../models/User");
const Shift = require("../models/Shift");
const Holiday = require("../models/Holiday");
const Client = require("../models/Client");
const Project = require("../models/Project");
const Task = require("../models/Task");
const LeaveRequest = require("../models/LeaveRequest");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

// Seed Shifts
const seedShifts = async () => {
  console.log("\n📅 Seeding Shifts...");

  const shifts = [
    {
      name: "Morning Shift (9 AM - 6 PM)",
      start: "09:00",
      end: "18:00",
      durationHours: 9,
      isFlexible: false,
      isActive: true,
      description: "Standard morning shift for office employees"
    },
    {
      name: "Evening Shift (2 PM - 11 PM)",
      start: "14:00",
      end: "23:00",
      durationHours: 9,
      isFlexible: false,
      isActive: true,
      description: "Evening shift for extended support"
    },
    {
      name: "Night Shift (11 PM - 8 AM)",
      start: "23:00",
      end: "08:00",
      durationHours: 9,
      isFlexible: false,
      isActive: true,
      description: "Night shift for 24/7 operations"
    }
  ];

  await Shift.deleteMany({});
  const createdShifts = await Shift.insertMany(shifts);
  console.log(`✅ Created ${createdShifts.length} shifts`);
  return createdShifts;
};

// Seed Holidays (Indian holidays 2024-2026)
const seedHolidays = async () => {
  console.log("\n🎉 Seeding Holidays...");

  const holidays = [
    // 2024
    { name: "New Year's Day", date: new Date("2024-01-01"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Republic Day", date: new Date("2024-01-26"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Holi", date: new Date("2024-03-25"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Good Friday", date: new Date("2024-03-29"), type: "RELIGIOUS", shifts: ["ALL"] },
    { name: "Eid al-Fitr", date: new Date("2024-04-11"), type: "RELIGIOUS", shifts: ["ALL"] },
    { name: "Independence Day", date: new Date("2024-08-15"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Dussehra", date: new Date("2024-10-12"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Diwali", date: new Date("2024-11-01"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Christmas", date: new Date("2024-12-25"), type: "RELIGIOUS", shifts: ["ALL"] },

    // 2025
    { name: "New Year's Day", date: new Date("2025-01-01"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Republic Day", date: new Date("2025-01-26"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Holi", date: new Date("2025-03-14"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Good Friday", date: new Date("2025-04-18"), type: "RELIGIOUS", shifts: ["ALL"] },
    { name: "Eid al-Fitr", date: new Date("2025-03-31"), type: "RELIGIOUS", shifts: ["ALL"] },
    { name: "Independence Day", date: new Date("2025-08-15"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Gandhi Jayanti", date: new Date("2025-10-02"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Dussehra", date: new Date("2025-10-02"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Diwali", date: new Date("2025-10-20"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Christmas", date: new Date("2025-12-25"), type: "RELIGIOUS", shifts: ["ALL"] },

    // 2026
    { name: "New Year's Day", date: new Date("2026-01-01"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Republic Day", date: new Date("2026-01-26"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Holi", date: new Date("2026-03-03"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Good Friday", date: new Date("2026-04-03"), type: "RELIGIOUS", shifts: ["ALL"] },
    { name: "Eid al-Fitr", date: new Date("2026-03-20"), type: "RELIGIOUS", shifts: ["ALL"] },
    { name: "Independence Day", date: new Date("2026-08-15"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Gandhi Jayanti", date: new Date("2026-10-02"), type: "NATIONAL", shifts: ["ALL"] },
    { name: "Dussehra", date: new Date("2026-10-21"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Diwali", date: new Date("2026-11-08"), type: "FESTIVAL", shifts: ["ALL"] },
    { name: "Christmas", date: new Date("2026-12-25"), type: "RELIGIOUS", shifts: ["ALL"] }
  ];

  await Holiday.deleteMany({});
  const createdHolidays = await Holiday.insertMany(holidays);
  console.log(`✅ Created ${createdHolidays.length} holidays`);
  return createdHolidays;
};

// Seed Users
const seedUsers = async (shifts) => {
  console.log("\n👥 Seeding Users...");

  const hashedPassword = await bcrypt.hash("password123", 10);
  const morningShift = shifts[0];

  const users = [
    // Super Admin
    {
      employeeId: "EMP001",
      name: "Rajesh Kumar",
      email: "admin@tapvera.com",
      contact: "+919876543210",
      dob: new Date("1985-05-15"),
      gender: "male",
      bloodGroup: "O+",
      permanentAddress: "123 MG Road, Bangalore, Karnataka",
      currentAddress: "123 MG Road, Bangalore, Karnataka",
      emergencyContact: "+919876543211",
      doj: new Date("2020-01-01"),
      salary: { basic: 80000, total: 100000, paymentMode: "bank" },
      password: hashedPassword,
      role: "super-admin",
      department: "executives",
      designation: "CEO",
      position: "Chief Executive Officer",
      positionLevel: 100,
      jobLevel: "executive",
      employmentType: "full-time",
      skills: ["Leadership", "Strategy", "Management"],
      status: "active",
      shiftType: "standard",
      assignedShift: morningShift._id,
      regions: ["Global"]
    },

    // Admin
    {
      employeeId: "EMP002",
      name: "Priya Sharma",
      email: "priya.admin@tapvera.com",
      contact: "+919876543212",
      dob: new Date("1988-08-20"),
      gender: "female",
      bloodGroup: "A+",
      permanentAddress: "456 Park Street, Mumbai, Maharashtra",
      currentAddress: "456 Park Street, Mumbai, Maharashtra",
      emergencyContact: "+919876543213",
      doj: new Date("2020-06-01"),
      salary: { basic: 60000, total: 75000, paymentMode: "bank" },
      password: hashedPassword,
      role: "admin",
      department: "executives",
      designation: "Operations Manager",
      position: "Operations Manager",
      positionLevel: 90,
      jobLevel: "senior",
      employmentType: "full-time",
      skills: ["Project Management", "Operations", "Team Leadership"],
      status: "active",
      shiftType: "standard",
      assignedShift: morningShift._id,
      regions: ["IND"]
    },

    // HR
    {
      employeeId: "EMP003",
      name: "Anita Desai",
      email: "anita.hr@tapvera.com",
      contact: "+919876543214",
      dob: new Date("1990-03-10"),
      gender: "female",
      bloodGroup: "B+",
      permanentAddress: "789 Ring Road, Delhi",
      currentAddress: "789 Ring Road, Delhi",
      emergencyContact: "+919876543215",
      doj: new Date("2021-01-15"),
      salary: { basic: 50000, total: 62000, paymentMode: "bank" },
      password: hashedPassword,
      role: "hr",
      department: "humanResource",
      designation: "HR Manager",
      position: "HR Manager",
      positionLevel: 80,
      jobLevel: "senior",
      employmentType: "full-time",
      skills: ["Recruitment", "Employee Relations", "Payroll"],
      status: "active",
      shiftType: "standard",
      assignedShift: morningShift._id,
      regions: ["IND"]
    },

    // Development Team
    {
      employeeId: "EMP004",
      name: "Amit Patel",
      email: "amit.dev@tapvera.com",
      contact: "+919876543216",
      dob: new Date("1992-07-22"),
      gender: "male",
      bloodGroup: "O-",
      permanentAddress: "321 Tech Park, Pune, Maharashtra",
      currentAddress: "321 Tech Park, Pune, Maharashtra",
      emergencyContact: "+919876543217",
      doj: new Date("2021-03-01"),
      salary: { basic: 55000, total: 68000, paymentMode: "bank" },
      password: hashedPassword,
      role: "employee",
      department: "development",
      designation: "Senior Developer",
      position: "Full Stack Developer",
      positionLevel: 70,
      jobLevel: "senior",
      employmentType: "full-time",
      skills: ["React", "Node.js", "MongoDB", "AWS"],
      status: "active",
      shiftType: "standard",
      assignedShift: morningShift._id,
      regions: ["Global"]
    },
    {
      employeeId: "EMP005",
      name: "Sneha Reddy",
      email: "sneha.dev@tapvera.com",
      contact: "+919876543218",
      dob: new Date("1994-11-05"),
      gender: "female",
      bloodGroup: "A-",
      permanentAddress: "654 Software City, Hyderabad, Telangana",
      currentAddress: "654 Software City, Hyderabad, Telangana",
      emergencyContact: "+919876543219",
      doj: new Date("2022-01-10"),
      salary: { basic: 45000, total: 55000, paymentMode: "bank" },
      password: hashedPassword,
      role: "employee",
      department: "development",
      designation: "Junior Developer",
      position: "Frontend Developer",
      positionLevel: 50,
      jobLevel: "mid",
      employmentType: "full-time",
      skills: ["React", "JavaScript", "CSS", "HTML"],
      status: "active",
      shiftType: "flexiblePermanent",
      regions: ["Global"]
    },
    {
      employeeId: "EMP006",
      name: "Vikram Singh",
      email: "vikram.dev@tapvera.com",
      contact: "+919876543220",
      dob: new Date("1993-09-18"),
      gender: "male",
      bloodGroup: "B-",
      permanentAddress: "987 Innovation Hub, Bangalore, Karnataka",
      currentAddress: "987 Innovation Hub, Bangalore, Karnataka",
      emergencyContact: "+919876543221",
      doj: new Date("2021-08-01"),
      salary: { basic: 48000, total: 59000, paymentMode: "bank" },
      password: hashedPassword,
      role: "employee",
      department: "development",
      designation: "Developer",
      position: "Backend Developer",
      positionLevel: 60,
      jobLevel: "mid",
      employmentType: "full-time",
      skills: ["Node.js", "Express", "MongoDB", "PostgreSQL"],
      status: "active",
      shiftType: "standard",
      assignedShift: morningShift._id,
      regions: ["Global"]
    },

    // Marketing & Sales
    {
      employeeId: "EMP007",
      name: "Kavya Iyer",
      email: "kavya.marketing@tapvera.com",
      contact: "+919876543222",
      dob: new Date("1991-04-25"),
      gender: "female",
      bloodGroup: "AB+",
      permanentAddress: "147 Market Street, Chennai, Tamil Nadu",
      currentAddress: "147 Market Street, Chennai, Tamil Nadu",
      emergencyContact: "+919876543223",
      doj: new Date("2021-05-01"),
      salary: { basic: 42000, total: 52000, paymentMode: "bank" },
      password: hashedPassword,
      role: "employee",
      department: "marketingAndSales",
      designation: "Marketing Manager",
      position: "Digital Marketing Manager",
      positionLevel: 65,
      jobLevel: "senior",
      employmentType: "full-time",
      skills: ["SEO", "Social Media", "Content Marketing", "Analytics"],
      status: "active",
      shiftType: "standard",
      assignedShift: morningShift._id,
      regions: ["IND", "USA"]
    },
    {
      employeeId: "EMP008",
      name: "Rahul Gupta",
      email: "rahul.sales@tapvera.com",
      contact: "+919876543224",
      dob: new Date("1989-12-08"),
      gender: "male",
      bloodGroup: "O+",
      permanentAddress: "258 Business District, Gurgaon, Haryana",
      currentAddress: "258 Business District, Gurgaon, Haryana",
      emergencyContact: "+919876543225",
      doj: new Date("2020-09-01"),
      salary: { basic: 45000, total: 58000, paymentMode: "bank" },
      password: hashedPassword,
      role: "employee",
      department: "marketingAndSales",
      designation: "Sales Executive",
      position: "Senior Sales Executive",
      positionLevel: 70,
      jobLevel: "senior",
      employmentType: "full-time",
      skills: ["Sales", "Client Relations", "Negotiation", "CRM"],
      status: "active",
      shiftType: "flexiblePermanent",
      regions: ["IND", "USA", "CANADA"]
    },

    // Additional Employees
    {
      employeeId: "EMP009",
      name: "Meera Krishnan",
      email: "meera.dev@tapvera.com",
      contact: "+919876543226",
      dob: new Date("1995-06-14"),
      gender: "female",
      bloodGroup: "A+",
      permanentAddress: "369 Cyber City, Bangalore, Karnataka",
      currentAddress: "369 Cyber City, Bangalore, Karnataka",
      emergencyContact: "+919876543227",
      doj: new Date("2022-06-01"),
      salary: { basic: 38000, total: 47000, paymentMode: "bank" },
      password: hashedPassword,
      role: "employee",
      department: "development",
      designation: "Junior Developer",
      position: "QA Engineer",
      positionLevel: 45,
      jobLevel: "junior",
      employmentType: "full-time",
      skills: ["Testing", "Selenium", "API Testing", "Bug Tracking"],
      status: "active",
      shiftType: "standard",
      assignedShift: morningShift._id,
      regions: ["Global"]
    },
    {
      employeeId: "EMP010",
      name: "Arjun Mehta",
      email: "arjun.marketing@tapvera.com",
      contact: "+919876543228",
      dob: new Date("1996-02-28"),
      gender: "male",
      bloodGroup: "B+",
      permanentAddress: "741 Creative Hub, Mumbai, Maharashtra",
      currentAddress: "741 Creative Hub, Mumbai, Maharashtra",
      emergencyContact: "+919876543229",
      doj: new Date("2023-01-15"),
      salary: { basic: 32000, total: 40000, paymentMode: "bank" },
      password: hashedPassword,
      role: "employee",
      department: "marketingAndSales",
      designation: "Marketing Associate",
      position: "Content Writer",
      positionLevel: 40,
      jobLevel: "junior",
      employmentType: "full-time",
      skills: ["Content Writing", "SEO", "Social Media", "Research"],
      status: "active",
      shiftType: "flexiblePermanent",
      regions: ["IND"]
    }
  ];

  await User.deleteMany({});
  const createdUsers = await User.insertMany(users);
  console.log(`✅ Created ${createdUsers.length} users`);
  console.log("\n📋 Login Credentials:");
  console.log("═".repeat(60));
  createdUsers.forEach(user => {
    console.log(`${user.role.toUpperCase().padEnd(15)} | ${user.email.padEnd(30)} | password123`);
  });
  console.log("═".repeat(60));
  return createdUsers;
};

// Seed Clients
const seedClients = async () => {
  console.log("\n🏢 Seeding Clients...");

  const hashedPassword = await bcrypt.hash("client123", 10);

  const clients = [
    {
      clientName: "Suresh Nair",
      businessName: "Tech Innovators Pvt Ltd",
      email: "suresh@techinnovators.com",
      password: hashedPassword,
      status: "Active",
      region: "IND"
    },
    {
      clientName: "Jennifer Smith",
      businessName: "Global Marketing Solutions",
      email: "jennifer@gmsolutions.com",
      password: hashedPassword,
      status: "Active",
      region: "USA"
    },
    {
      clientName: "David Chen",
      businessName: "E-Commerce Enterprises",
      email: "david@ecomenterprises.com",
      password: hashedPassword,
      status: "Active",
      region: "CANADA"
    },
    {
      clientName: "Ravi Shankar",
      businessName: "FinTech Innovations",
      email: "ravi@fintechinnovations.com",
      password: hashedPassword,
      status: "Active",
      region: "IND"
    },
    {
      clientName: "Dr. Sarah Johnson",
      businessName: "HealthCare Systems Inc",
      email: "sarah@healthcaresys.com",
      password: hashedPassword,
      status: "Active",
      region: "USA"
    }
  ];

  await Client.deleteMany({});
  const createdClients = await Client.insertMany(clients);
  console.log(`✅ Created ${createdClients.length} clients`);
  console.log("\n📋 Client Login Credentials:");
  console.log("═".repeat(60));
  createdClients.forEach(client => {
    console.log(`${client.businessName.padEnd(35)} | ${client.email.padEnd(30)} | client123`);
  });
  console.log("═".repeat(60));
  return createdClients;
};

// Main seed function
const seedDatabase = async () => {
  console.log("\n🌱 Starting Database Seeding...");
  console.log("═".repeat(60));

  try {
    await connectDB();

    // Seed in order (dependencies matter)
    const shifts = await seedShifts();
    const holidays = await seedHolidays();
    const users = await seedUsers(shifts);
    const clients = await seedClients();

    console.log("\n");
    console.log("═".repeat(60));
    console.log("✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log("═".repeat(60));
    console.log("\n📊 Summary:");
    console.log(`   • Shifts: ${shifts.length}`);
    console.log(`   • Holidays: ${holidays.length}`);
    console.log(`   • Users: ${users.length}`);
    console.log(`   • Clients: ${clients.length}`);
    console.log("\n🔐 All users have password: password123");
    console.log("\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    process.exit(1);
  }
};

// Run the seeder
seedDatabase();

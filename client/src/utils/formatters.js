// Shared display formatters

const DEPARTMENT_LABELS = {
  executives: "Executives",
  development: "Development",
  marketingAndSales: "Marketing & Sales",
  humanResource: "Human Resource",
  finance: "Finance",
  operations: "Operations",
  legal: "Legal",
  it: "IT",
  sales: "Sales",
  marketing: "Marketing",
  customerSupport: "Customer Support",
  design: "Design",
  productManagement: "Product Management",
  qualityAssurance: "Quality Assurance",
  research: "Research",
  administration: "Administration",
};

/**
 * Convert stored department value to display label.
 * Falls back to splitting camelCase if no explicit mapping found.
 */
export function formatDepartment(value) {
  if (!value) return "N/A";
  if (DEPARTMENT_LABELS[value]) return DEPARTMENT_LABELS[value];

  // Generic camelCase → "Title Case Words" fallback
  return value
    .replace(/([A-Z])/g, " $1")          // insert space before capitals
    .replace(/^./, (c) => c.toUpperCase()) // capitalize first letter
    .trim();
}

const JOB_LEVEL_LABELS = {
  intern: "Intern",
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  lead: "Lead",
  director: "Director",
  executive: "Executive",
};

export function formatJobLevel(value) {
  if (!value) return "N/A";
  return JOB_LEVEL_LABELS[value] || value;
}

const EMPLOYMENT_TYPE_LABELS = {
  "full-time": "Full-Time",
  "part-time": "Part-Time",
  contract: "Contract",
  internship: "Internship",
};

export function formatEmploymentType(value) {
  if (!value) return "N/A";
  return EMPLOYMENT_TYPE_LABELS[value] || value;
}

const PAYMENT_MODE_LABELS = {
  bank: "Bank Transfer",
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
};

export function formatPaymentMode(value) {
  if (!value) return "N/A";
  return PAYMENT_MODE_LABELS[value] || value;
}

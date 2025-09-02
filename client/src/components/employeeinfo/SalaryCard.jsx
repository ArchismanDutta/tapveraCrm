import React from "react";

const SalaryCard = ({ salary }) => {
  const totalSalary = salary?.total || salary?.basic || 0;

  return (
    <div className="p-6 rounded-2xl shadow border border-[#283255] bg-[#181f34] text-blue-100">
      <h3 className="text-xl font-semibold text-blue-300 mb-3">💰 Salary</h3>
      <p className="text-blue-100 text-lg font-medium">
        {totalSalary > 0
          ? `₹${totalSalary.toLocaleString("en-IN")}`
          : "Not Assigned"}
      </p>
      {salary?.paymentMode && (
        <p className="text-blue-300 text-sm mt-1">
          Payment Mode: {salary.paymentMode}
        </p>
      )}
    </div>
  );
};

export default SalaryCard;

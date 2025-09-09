import React from "react";

const SalaryCard = ({ salary }) => {
  const totalSalary = salary?.total || salary?.basic || 0;

  return (
    <div className="p-6 rounded-2xl shadow-md border border-[#283255] bg-[#181f34] text-blue-100 flex flex-col items-center">
      <h3 className="text-xl font-bold text-cyan-300 mb-4 flex items-center gap-2">
        <span role="img" aria-label="Salary">💰</span> Salary
      </h3>
      <p className="text-cyan-100 text-3xl font-extrabold mb-2">
        {totalSalary > 0
          ? `₹${totalSalary.toLocaleString("en-IN")}`
          : "Not Assigned"}
      </p>
      {salary?.paymentMode && (
        <p className="text-cyan-200 text-sm mt-1">
          Payment Mode: <span className="font-semibold">{salary.paymentMode}</span>
        </p>
      )}
    </div>
  );
};

export default SalaryCard;

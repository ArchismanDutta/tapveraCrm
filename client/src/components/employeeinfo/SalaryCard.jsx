// SalaryCard.jsx
import React from "react";

const SalaryCard = ({ salary = {} }) => {
  const { basic = 0, total = 0, paymentMode = "N/A" } = salary;

  return (
    <div className="border rounded-3xl shadow-2xl p-8 bg-gradient-to-r from-green-100 to-green-200 hover:from-green-200 hover:to-green-300 transition-all duration-400 transform hover:-translate-y-1">
      <h2 className="text-3xl font-extrabold text-green-900 mb-6 tracking-wider">Salary & Benefits</h2>
      <p className="text-green-900 text-lg mb-4">
        <strong className="font-semibold">Basic:</strong> ${basic.toLocaleString()}
      </p>
      <p className="text-green-900 text-lg mb-4">
        <strong className="font-semibold">Total Compensation:</strong> ${total.toLocaleString()}
      </p>
      <p className="text-green-900 text-lg">
        <strong className="font-semibold">Payment Mode:</strong> {paymentMode}
      </p>
    </div>
  );
};

export default SalaryCard;

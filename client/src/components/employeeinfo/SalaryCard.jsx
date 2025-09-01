import React from "react";

const SalaryCard = ({ salary = {} }) => {
  const { basic = 0, total = 0, paymentMode = "N/A" } = salary;

  return (
    <div
      className="border border-green-700 rounded-3xl shadow-2xl p-8
                 bg-gradient-to-r from-green-900/20 to-green-800/20
                 hover:from-green-900/30 hover:to-green-800/30
                 transition-all duration-400 transform hover:-translate-y-1"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <h2 className="text-3xl font-extrabold text-green-300 mb-6 tracking-widest drop-shadow-md">
        Salary &amp; Benefits
      </h2>
      <p className="text-green-100 text-lg mb-5">
        <strong className="font-semibold">Basic:</strong> ${basic.toLocaleString()}
      </p>
      <p className="text-green-100 text-lg mb-5">
        <strong className="font-semibold">Total Compensation:</strong> ${total.toLocaleString()}
      </p>
      <p className="text-green-100 text-lg">
        <strong className="font-semibold">Payment Mode:</strong> {paymentMode}
      </p>
    </div>
  );
};

export default SalaryCard;

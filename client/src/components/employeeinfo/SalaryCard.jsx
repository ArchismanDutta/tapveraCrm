import React from "react";

const SalaryCard = ({ salary }) => {
  const totalSalary = salary?.total || salary?.basic || 0;

  return (
    <div className="app-panel flex flex-col justify-between rounded-2xl p-5">
      <div>
        <p className="app-eyebrow">Compensation</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Salary</h3>
      </div>
      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/30 dark:bg-blue-500/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">Total Salary</p>
        <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">
          {totalSalary > 0 ? `₹${totalSalary.toLocaleString("en-IN")}` : "Not Assigned"}
        </p>
        {salary?.paymentMode && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Payment Mode: <span className="font-semibold capitalize text-slate-900 dark:text-slate-100">{salary.paymentMode}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default SalaryCard;

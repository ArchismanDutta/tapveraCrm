import React from "react";

const DepartmentLeaveWarningModal = ({
  isOpen,
  onClose,
  onProceed,
  department,
  currentLeaves,
  selectedEmployee,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-gradient-to-br from-yellow-50 via-yellow-100 to-orange-50 rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5 border border-yellow-300">
        <h2 className="text-2xl font-bold text-yellow-800 drop-shadow-sm">
          Department Leave Alert
        </h2>
        <p className="text-yellow-900 text-base leading-relaxed">
          You are about to approve/reject leave for{" "}
          <span className="font-semibold">{selectedEmployee?.employee?.name || selectedEmployee?.name}</span>{" "}
          from{" "}
          <span className="font-semibold">{department}</span> department.
        </p>

        {currentLeaves && currentLeaves.length > 0 ? (
          <div className="flex flex-col gap-3 max-h-52 overflow-y-auto border border-yellow-300 rounded-md p-3 bg-yellow-100 shadow-inner">
            <span className="font-semibold text-yellow-700 mb-1 tracking-wide">
              Employees already on leave:
            </span>
            {currentLeaves.map((leave) => (
              <div
                key={leave._id}
                className="flex justify-between text-yellow-900 text-sm px-3 py-1 rounded hover:bg-yellow-200 transition-colors cursor-default"
              >
                <span>{leave.employee?.name}</span>
                <span className="text-yellow-700 font-mono">
                  {new Date(leave.period.start).toLocaleDateString()} -{" "}
                  {new Date(leave.period.end).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-yellow-800 font-medium text-sm italic">
            No other employees are on leave.
          </p>
        )}

        <div className="flex justify-end gap-4 mt-5">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded border border-yellow-600 text-yellow-800 font-semibold hover:bg-yellow-200 focus:outline-yellow-500 transition"
          >
            Close
          </button>
          <button
            onClick={onProceed}
            className="px-5 py-2 rounded bg-yellow-600 hover:bg-yellow-700 text-white font-semibold focus:outline-yellow-500 transition"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentLeaveWarningModal;

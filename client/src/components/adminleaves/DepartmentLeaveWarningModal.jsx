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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-700 rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5 border border-yellow-600">
        <h2 className="text-2xl font-bold text-yellow-300 drop-shadow-sm">
          Department Leave Alert
        </h2>
        <p className="text-yellow-200 text-base leading-relaxed">
          You are about to approve/reject leave for{" "}
          <span className="font-semibold text-yellow-300">
            {selectedEmployee?.employee?.name || selectedEmployee?.name}
          </span>{" "}
          from{" "}
          <span className="font-semibold text-yellow-300">{department}</span>{" "}
          department.
        </p>

        {currentLeaves && currentLeaves.length > 0 ? (
          <div className="flex flex-col gap-3 max-h-52 overflow-y-auto border border-yellow-600 rounded-md p-3 bg-yellow-900 shadow-inner">
            <span className="font-semibold text-yellow-400 mb-1 tracking-wide">
              Employees already on leave:
            </span>
            {currentLeaves.map((leave) => (
              <div
                key={leave._id}
                className="flex justify-between text-yellow-300 text-sm px-3 py-1 rounded hover:bg-yellow-800 transition-colors cursor-default"
              >
                <span>{leave.employee?.name}</span>
                <span className="text-yellow-400 font-mono">
                  {new Date(leave.period.start).toLocaleDateString()} -{" "}
                  {new Date(leave.period.end).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-yellow-300 font-medium text-sm italic">
            No other employees are on leave.
          </p>
        )}

        <div className="flex justify-end gap-4 mt-5">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded border border-yellow-700 text-yellow-300 font-semibold hover:bg-yellow-800 focus:outline-yellow-500 transition"
          >
            Close
          </button>
          <button
            onClick={onProceed}
            className="px-5 py-2 rounded bg-yellow-700 hover:bg-yellow-800 text-white font-semibold focus:outline-yellow-500 transition"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartmentLeaveWarningModal;

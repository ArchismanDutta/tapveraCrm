import React from "react";

const PunchOutTodoPopup = ({ tasks, onClose, onFindOut, onMoveToTomorrow }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(19,23,32,0.96)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    }}
  >
    <div className="bg-[#161c2c] rounded-xl shadow-2xl p-8 max-w-md w-full border border-[#232945] text-gray-100">
      <h2 className="text-lg font-bold mb-4">Pending Tasks in Your Todo List</h2>
      <ul className="max-h-40 overflow-auto mb-4 space-y-2">
        {tasks.map((t) => (
          <li key={t._id} className="truncate text-yellow-400 text-md font-semibold">
            {t.title}
          </li>
        ))}
      </ul>
      <p className="mb-6 text-sm text-gray-400">
        Do you wish to handle them now or move them into tomorrow's list?
      </p>
      <div className="flex justify-end space-x-4">
        <button
          onClick={onClose}
          title="Dismiss"
          className="px-5 py-2 rounded-md bg-[#232945] text-gray-300 font-semibold hover:bg-[#444c6a] transition"
        >
          ✖
        </button>
        <button
          onClick={onFindOut}
          className="px-5 py-2 rounded-md bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold shadow hover:from-blue-700 hover:to-blue-500 transition"
        >
          Find Out
        </button>
        <button
          onClick={onMoveToTomorrow}
          className="px-5 py-2 rounded-md bg-gradient-to-r from-green-600 to-green-400 text-white font-semibold shadow hover:from-green-700 hover:to-green-500 transition"
        >
          Add to Tomorrow
        </button>
      </div>
    </div>
  </div>
);

export default PunchOutTodoPopup;

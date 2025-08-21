import React from "react";

const PunchOutTodoPopup = ({ tasks, onClose, onFindOut, onMoveToTomorrow }) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.2)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    }}
  >
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
      <h2 className="text-lg font-bold mb-2">Pending Tasks in Your Todo List</h2>
      <ul className="max-h-40 overflow-auto mb-3">
        {tasks.map((t) => (
          <li key={t._id} className="mb-1 truncate text-gray-700">
            {t.title}
          </li>
        ))}
      </ul>
      <p className="mb-4 text-sm text-gray-600">
        Do you wish to handle them now or move them into tomorrow's list?
      </p>
      <div className="flex justify-end space-x-3">
        <button
          onClick={onClose}
          title="Dismiss"
          className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
        >
          ✖
        </button>
        <button
          onClick={onFindOut}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Find Out
        </button>
        <button
          onClick={onMoveToTomorrow}
          className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
        >
          Add to Tomorrow
        </button>
      </div>
    </div>
  </div>
);

export default PunchOutTodoPopup;

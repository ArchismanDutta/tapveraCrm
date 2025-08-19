import React from "react";

const ImportantNoticeModal = ({ notices, onClose }) => {
  if (!notices || notices.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      ></div>

      {/* Popover card */}
      <div className="absolute top-full right-0 mt-2 w-96 bg-gradient-to-tr from-orange-50 via-yellow-100 to-white rounded-2xl shadow-2xl border border-pink-200 z-50 animate-fade-in">
        {/* Arrow pointing to button */}
        <div className="absolute -top-2 right-5 w-4 h-4 bg-gradient-to-tr from-orange-50 via-yellow-100 to-white transform rotate-45 border-t border-l border-pink-200"></div>

        <div className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-pinkAccent">
              Important Leave Updates
            </h3>
            <button
              onClick={onClose}
              className="text-pinkAccent hover:text-pinkAccent/80 text-lg font-semibold"
            >
              ✕
            </button>
          </div>

          <ul className="space-y-2">
            {notices.map((notice, idx) => (
              <li
                key={idx}
                className="p-3 bg-white rounded-xl border border-orange-200 shadow-sm text-pinkAccent font-medium text-sm hover:bg-yellow-50 transition"
              >
                {notice}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export default ImportantNoticeModal;

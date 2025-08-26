import React from "react";

const ImportantNoticeModal = ({ notices, onClose }) => {
  if (!notices || notices.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      ></div>

      {/* Popover card */}
      <div
        className="absolute top-full right-0 mt-2 w-96 bg-gradient-to-tr from-[#ff8000]/10 to-[#ff8000]/5 rounded-3xl shadow-2xl border border-[#ff8000]/20 z-50 animate-fade-in"
      >
        {/* Arrow pointing to button */}
        <div className="absolute -top-2 right-5 w-4 h-4 bg-gradient-to-tr from-[#ff8000]/10 to-[#ff8000]/5 transform rotate-45 border-t border-l border-[#ff8000]/20"></div>

        <div className="p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-[#ff8000]">Important Leave Updates</h3>
            <button
              onClick={onClose}
              className="text-[#ff8000] hover:text-[#ff8000]/80 text-lg font-semibold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <ul className="space-y-2">
            {notices.map((notice, idx) => (
              <li
                key={idx}
                className="p-3 bg-[rgba(255,128,0,0.1)] rounded-xl border border-[#ff8000]/30 shadow-sm text-[#ff8000] font-medium text-sm hover:bg-[#ff8000]/20 transition"
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

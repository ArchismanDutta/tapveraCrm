import React from "react";
import dayjs from "dayjs";

const NoticeList = ({ notices, onDeactivate }) => {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-4 text-gray-200">Active Notices</h2>
      <div className="space-y-4">
        {notices.length === 0 && (
          <p className="text-gray-400">No notices published yet.</p>
        )}

        {notices.map((notice) => (
          <div
            key={notice._id}
            className="flex justify-between items-center p-4 border border-gray-700 rounded-lg shadow-sm bg-gray-800 text-gray-200"
          >
            {/* Left side: message & date */}
            <div>
              <p className="font-medium">{notice.message}</p>
              <p className="text-sm text-gray-400">
                {dayjs(notice.createdAt).format("DD/MM/YYYY, HH:mm:ss")}
              </p>
            </div>

            {/* Right side: status / action */}
            <div>
              {notice.isActive ? (
                <button
                  onClick={() => onDeactivate(notice._id)}
                  className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition"
                >
                  Deactivate
                </button>
              ) : (
                <span className="px-3 py-1 rounded bg-gray-600 text-gray-400">
                  Inactive
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NoticeList;

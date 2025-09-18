import React, { useEffect, useState } from "react";
import API from "../../api";

export default function NoticeOverlay() {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("noticesDismissed");
    if (!dismissed) {
      fetchNotices();
    }
  }, []);

  const fetchNotices = async () => {
    try {
      const res = await API.get("/api/notices"); // your endpoint
      setNotices(res.data || []);
    } catch (err) {
      console.error("Error fetching notices:", err);
    }
  };

  const handleClose = () => {
    setNotices([]);
    sessionStorage.setItem("noticesDismissed", "true"); // remember for this session
  };

  return (
    <>
      {notices.length > 0 && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/90 rounded-lg shadow-xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4">📢 Notices</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {notices.map((n) => (
                <div
                  key={n._id}
                  className="border-l-4 border-orange-500 pl-3 text-gray-800"
                >
                  <p>{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    🕒 {new Date(n.createdAt).toLocaleString()}
                    {n.createdBy?.name && <> • 👤 {n.createdBy.name}</>}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={handleClose}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

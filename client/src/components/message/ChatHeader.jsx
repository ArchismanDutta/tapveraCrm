import React from "react";
import { Circle } from "lucide-react";

export default function ChatHeader({ selectedUser, typingUsers }) {
  return (
    <div className="p-4 border-b border-gray-300 bg-white flex items-center gap-3 shadow-sm shrink-0">
      {selectedUser ? (
        <>
          <img
            src={`https://ui-avatars.com/api/?name=${selectedUser.name}`}
            alt="avatar"
            className="w-6 h-6 rounded-full"
          />
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
            {typingUsers[selectedUser._id] ? (
              <span className="text-xs text-gray-500 italic">typing...</span>
            ) : (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <Circle size={8} className="fill-green-500" />
              </span>
            )}
          </div>
        </>
      ) : (
        <h3 className="text-lg text-gray-500">Select a contact</h3>
      )}
    </div>
  );
}

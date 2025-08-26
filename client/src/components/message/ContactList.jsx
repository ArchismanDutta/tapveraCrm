import React from "react";

export default function ContactsList({
  filteredUsers,
  selectedUser,
  newMessagesByUser,
  selectUser,
  searchTerm,
  setSearchTerm,
}) {
  return (
    <div className="w-1/4 bg-white border-l border-gray-300 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-300 shrink-0">
        <h3 className="text-lg font-bold">Contacts</h3>
      </div>
      <div className="p-2 border-b border-gray-200 shrink-0">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring focus:ring-blue-200"
        />
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {filteredUsers.map((user) => {
          const isSelected = selectedUser?._id === user._id;
          const hasNewMessage = newMessagesByUser[user._id];
          return (
            <div
              key={user._id}
              onClick={() => selectUser(user)}
              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-100 ${
                isSelected
                  ? "bg-blue-50"
                  : hasNewMessage
                  ? "bg-yellow-100 font-semibold"
                  : ""
              }`}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${user.name}`}
                alt="avatar"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-medium">{user.name}</p>
                <span className="text-xs text-gray-500">{user.role}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";

const CreateGroupModal = ({ isOpen, onClose, onCreate, jwtToken }) => {
  const [groupName, setGroupName] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Use env variable with localhost fallback
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  useEffect(() => {
    if (!jwtToken) return;

    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users`, {
          headers: { Authorization: `Bearer ${jwtToken}` },
        });

        // fallback if API_BASE is set but not reachable
        if (!res.ok) {
          console.warn(
            "Primary API_BASE not reachable, falling back to localhost"
          );
          const fallbackRes = await fetch(`${API_BASE}/api/users`, {
            headers: { Authorization: `Bearer ${jwtToken}` },
          });
          const data = await fallbackRes.json();
          setUsers(data);
          return;
        }

        const data = await res.json();
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);

        // try localhost if API_BASE fails completely
        try {
          const fallbackRes = await fetch(`${API_BASE}/api/users`, {
            headers: { Authorization: `Bearer ${jwtToken}` },
          });
          const data = await fallbackRes.json();
          setUsers(data);
        } catch (err) {
          console.error("Fallback also failed:", err);
        }
      }
    };

    fetchUsers();
  }, [jwtToken, API_BASE]);

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) {
      alert("Group name and at least one member are required");
      return;
    }
    onCreate(groupName.trim(), selectedMembers);
    setGroupName("");
    setSelectedMembers([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-gray-900 text-gray-100 rounded-2xl shadow-2xl p-6 w-96 max-w-full border border-gray-800">
        <h2 className="text-2xl font-bold mb-4 text-white">Create New Group</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />

          <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-800 border border-gray-700 p-3 custom-scroll">
            {users.length === 0 ? (
              <p className="text-gray-400 text-sm">No users available</p>
            ) : (
              users.map((user) => (
                <label
                  key={user._id}
                  className="flex items-center py-1 px-2 rounded-md cursor-pointer hover:bg-gray-700 transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user._id)}
                    onChange={() => toggleMember(user._id)}
                    className="mr-2 accent-blue-500"
                  />
                  <span>
                    {user.name}{" "}
                    <span className="text-xs text-gray-400">({user.role})</span>
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md hover:shadow-lg transition"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;

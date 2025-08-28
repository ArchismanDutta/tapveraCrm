import React, { useState, useEffect } from "react";

const CreateGroupModal = ({ isOpen, onClose, onCreate, jwtToken }) => {
  const [groupName, setGroupName] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  useEffect(() => {
    if (!jwtToken) return;

    fetch("http://localhost:5000/api/users", {
      headers: { Authorization: `Bearer ${jwtToken}` },
    })
      .then((res) => res.json())
      .then(setUsers)
      .catch(console.error);
  }, [jwtToken]);

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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-full">
        <h2 className="text-xl font-semibold mb-4">Create New Group</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Group Name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-3 py-2 mb-4 border rounded"
            required
          />
          <div className="max-h-48 overflow-y-auto mb-4 border rounded p-2">
            {users.map((user) => (
              <label key={user._id} className="block">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(user._id)}
                  onChange={() => toggleMember(user._id)}
                  className="mr-2"
                />
                {user.name} ({user.role})
              </label>
            ))}
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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

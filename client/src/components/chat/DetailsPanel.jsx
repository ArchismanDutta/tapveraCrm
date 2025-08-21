import React from "react";

const DetailsPanel = ({ selectedChat }) => {
  const otherMember = selectedChat?.members.find(
    (m) => m._id !== localStorage.getItem("userId")
  );
  if (!otherMember) return null;

  return (
    <div className="w-64 border-l p-4 bg-gray-50 shadow-inner">
      <h3 className="font-bold text-lg mb-3">Employee Details</h3>
      <p className="mb-1">
        <span className="font-semibold">Name:</span> {otherMember.name}
      </p>
      <p className="mb-1">
        <span className="font-semibold">Email:</span> {otherMember.email || "-"}
      </p>
      <p className="mb-1">
        <span className="font-semibold">Role:</span> {otherMember.role}
      </p>
    </div>
  );
};

export default DetailsPanel;

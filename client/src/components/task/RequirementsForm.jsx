import React, { useState } from "react";

const RequirementsForm = () => {
  const [requirement, setRequirement] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (requirement.trim()) {
      console.log("Requirement submitted:", requirement);
      setRequirement("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
        placeholder="Enter requirements..."
        className="flex-1 border rounded-lg px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="bg-pinkAccent text-white px-4 py-2 rounded-lg text-sm"
      >
        Send
      </button>
    </form>
  );
};

export default RequirementsForm;

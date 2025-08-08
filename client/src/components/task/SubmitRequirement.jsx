import React, { useState } from "react";

const SubmitRequirement = ({ onSubmit }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    priority: "High",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.description.trim()) {
      alert("Please fill all fields before submitting.");
      return;
    }

    setLoading(true);
    setSuccess(false);

    setTimeout(() => {
      onSubmit(form);
      setForm({ name: "", description: "", priority: "High" });
      setLoading(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }, 400);
  };

  return (
    <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-100 rounded-xl shadow-lg p-5 border border-yellow-200">
      <h3 className="font-bold text-lg text-orange-500 mb-4 flex items-center gap-2">
        📌 Submit Requirement
      </h3>

      <input
        type="text"
        name="name"
        placeholder="Enter project name"
        className="border border-black-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 w-full p-2 rounded-lg mb-3 text-sm bg-white/70"
        value={form.name}
        onChange={handleChange}
      />

      <textarea
        name="description"
        placeholder="Enter description"
        className="border border-black-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 w-full p-2 rounded-lg mb-3 text-sm bg-white/70"
        rows="3"
        value={form.description}
        onChange={handleChange}
      />

      <select
        name="priority"
        className="border border-black-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-300 w-full p-2 rounded-lg mb-3 text-sm bg-white/70"
        value={form.priority}
        onChange={handleChange}
      >
        <option>High</option>
        <option>Medium</option>
        <option>Low</option>
      </select>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full p-2 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200 bg-gradient-to-r from-yellow-300 via-orange-300 to-orange-400 text-black hover:from-orange-400 hover:to-yellow-300 text-sm transform active:scale-95 ${
          loading ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        {loading ? "Submitting..." : success ? "✅ Submitted!" : "Submit Requirement"}
      </button>
    </div>
  );
};

export default SubmitRequirement;

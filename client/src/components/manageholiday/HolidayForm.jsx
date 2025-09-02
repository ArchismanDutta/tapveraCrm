import React, { useState } from "react";

const HolidayForm = ({ onAdd }) => {
  const [form, setForm] = useState({
    name: "",
    date: "",
    type: "NATIONAL",
    recurring: false,
    optional: false,
    shifts: ["ALL"],
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleShiftsChange = (e) => {
    const { value } = e.target;
    setForm((prev) => ({
      ...prev,
      shifts: value === "ALL" ? ["ALL"] : [value],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.date) return alert("Name and date required");
    onAdd(form);
    setForm({
      name: "",
      date: "",
      type: "NATIONAL",
      recurring: false,
      optional: false,
      shifts: ["ALL"],
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      {/* Row 1: Inputs */}
      <div className="flex flex-wrap gap-4 items-center">
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Holiday Name"
          className="border border-[#82aaff] bg-[#1b2439] text-white placeholder-[#6c7897] rounded-lg p-3 w-52 focus:outline-none focus:ring-2 focus:ring-[#58a6ff] transition"
          required
        />

        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          placeholder="dd-mm-yyyy"
          className="border border-[#82aaff] bg-[#1b2439] text-white rounded-lg p-3 w-48 focus:outline-none focus:ring-2 focus:ring-[#58a6ff] transition"
          required
        />

        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          className="border border-[#82aaff] bg-[#1b2439] text-white rounded-lg p-3 w-48 focus:outline-none focus:ring-2 focus:ring-[#58a6ff] transition"
        >
          <option value="NATIONAL">National</option>
          <option value="COMPANY">Company</option>
          <option value="RELIGIOUS">Religious</option>
          <option value="FESTIVAL">Festival</option>
        </select>

        <select
          name="shifts"
          value={form.shifts}
          onChange={handleShiftsChange}
          className="border border-[#82aaff] bg-[#1b2439] text-white rounded-lg p-3 w-40 focus:outline-none focus:ring-2 focus:ring-[#58a6ff] transition"
        >
          <option value="ALL">All</option>
          <option value="standard">Standard</option>
          <option value="flexiblePermanent">Flexible Permanent</option>
        </select>
      </div>

      {/* Row 2: Checkboxes + Button */}
      <div className="flex flex-wrap gap-4 items-center justify-between mt-2">
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-white font-normal">
            <input
              type="checkbox"
              name="optional"
              checked={form.optional}
              onChange={handleChange}
              className="accent-[#58a6ff] scale-125"
            />
            Optional
          </label>
          <label className="flex items-center gap-2 text-white font-normal">
            <input
              type="checkbox"
              name="recurring"
              checked={form.recurring}
              onChange={handleChange}
              className="accent-[#58a6ff] scale-125"
            />
            Recurring
          </label>
        </div>
        <button
          type="submit"
          className="bg-gradient-to-r from-[#58a6ff] to-[#485fc7] text-white font-semibold px-12 py-4 rounded-lg shadow-lg hover:scale-110 transition-transform duration-200"
          style={{ minWidth: "170px" }}
        >
          Add Holiday
        </button>
      </div>
    </form>
  );
};

export default HolidayForm;

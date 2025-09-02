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
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
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
      className="flex flex-wrap gap-4 bg-gray-50 p-4 rounded shadow-md"
    >
      <input
        type="text"
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Holiday Name"
        className="border p-2 rounded w-48"
        required
      />
      <input
        type="date"
        name="date"
        value={form.date}
        onChange={handleChange}
        className="border p-2 rounded"
        required
      />
      <select
        name="type"
        value={form.type}
        onChange={handleChange}
        className="border p-2 rounded"
      >
        <option value="NATIONAL">National</option>
        <option value="COMPANY">Company</option>
        <option value="RELIGIOUS">Religious</option>
        <option value="FESTIVAL">Festival</option>
      </select>
      <select
        name="shifts"
        value={form.shifts[0]}
        onChange={handleShiftsChange}
        className="border p-2 rounded"
      >
        <option value="ALL">All</option>
        <option value="standard">Standard</option>
        <option value="flexiblePermanent">Flexible Permanent</option>
      </select>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="recurring"
          checked={form.recurring}
          onChange={handleChange}
        />
        Recurring
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="optional"
          checked={form.optional}
          onChange={handleChange}
        />
        Optional
      </label>
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Add Holiday
      </button>
    </form>
  );
};

export default HolidayForm;

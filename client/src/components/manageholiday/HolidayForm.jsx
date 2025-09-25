import React, { useState, useEffect } from "react";

const HolidayForm = ({ onAdd, onUpdate, editingHoliday, onCancelEdit }) => {
  const [form, setForm] = useState({
    name: "",
    date: "",
    type: "NATIONAL",
    recurring: false,
    optional: false,
    shifts: ["ALL"],
  });

  useEffect(() => {
    if (editingHoliday) {
      setForm({
        name: editingHoliday.name,
        date: new Date(editingHoliday.date).toISOString().split('T')[0],
        type: editingHoliday.type,
        recurring: editingHoliday.recurring,
        optional: editingHoliday.optional,
        shifts: editingHoliday.shifts,
      });
    } else {
      setForm({
        name: "",
        date: "",
        type: "NATIONAL",
        recurring: false,
        optional: false,
        shifts: ["ALL"],
      });
    }
  }, [editingHoliday]);

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

    if (editingHoliday) {
      onUpdate(editingHoliday._id, form);
    } else {
      onAdd(form);
    }

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
          className="border border-[#232945] bg-[#141a21] text-white placeholder-blue-300 rounded-lg p-3 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          required
        />

        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          placeholder="dd-mm-yyyy"
          className="border border-[#232945] bg-[#141a21] text-white rounded-lg p-3 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          required
        />

        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          className="border border-[#232945] bg-[#141a21] text-white rounded-lg p-3 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
          className="border border-[#232945] bg-[#141a21] text-white rounded-lg p-3 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
        >
          <option value="ALL">All</option>
          <option value="standard">Standard</option>
          <option value="flexiblePermanent">Flexible Permanent</option>
        </select>
      </div>

      {/* Row 2: Checkboxes + Button */}
      <div className="flex flex-wrap gap-4 items-center justify-between mt-2">
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-blue-100 font-normal">
            <input
              type="checkbox"
              name="optional"
              checked={form.optional}
              onChange={handleChange}
              className="accent-blue-500 scale-125"
            />
            Optional
          </label>
          <label className="flex items-center gap-2 text-blue-100 font-normal">
            <input
              type="checkbox"
              name="recurring"
              checked={form.recurring}
              onChange={handleChange}
              className="accent-blue-500 scale-125"
            />
            Recurring
          </label>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-colors duration-200"
            style={{ minWidth: "150px" }}
          >
            {editingHoliday ? "Update Holiday" : "Add Holiday"}
          </button>
          {editingHoliday && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition-colors duration-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default HolidayForm;

import React, { useState, useEffect } from "react";

const HolidayForm = ({ onAdd, onUpdate, editingHoliday, onCancelEdit }) => {
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    type: "NATIONAL",
    shifts: ["ALL"],
  });

  useEffect(() => {
    if (editingHoliday) {
      setForm({
        name: editingHoliday.name,
        startDate: new Date(editingHoliday.date).toISOString().split('T')[0],
        endDate: new Date(editingHoliday.date).toISOString().split('T')[0],
        type: editingHoliday.type,
        shifts: editingHoliday.shifts,
      });
    } else {
      setForm({
        name: "",
        startDate: "",
        endDate: "",
        type: "NATIONAL",
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.startDate) return alert("Name and start date required");

    if (editingHoliday) {
      // For editing, just update the single holiday
      onUpdate(editingHoliday._id, {
        name: form.name,
        date: form.startDate,
        type: form.type,
        shifts: form.shifts
      });
    } else {
      // For adding, check if we have a date range
      const start = new Date(form.startDate);
      const end = form.endDate ? new Date(form.endDate) : new Date(form.startDate);

      // Validate that end date is not before start date
      if (end < start) {
        return alert("End date cannot be before start date");
      }

      // If it's a single date or a range, create holidays for each day
      const dates = [];
      const currentDate = new Date(start);

      while (currentDate <= end) {
        dates.push(new Date(currentDate).toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Create a holiday for each date in the range
      for (const date of dates) {
        await onAdd({
          name: form.name,
          date: date,
          type: form.type,
          shifts: form.shifts,
        });
      }
    }

    setForm({
      name: "",
      startDate: "",
      endDate: "",
      type: "NATIONAL",
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

        <div className="flex gap-2 items-center">
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            placeholder="Start Date"
            className="border border-[#232945] bg-[#141a21] text-white rounded-lg p-3 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            required
          />
          <span className="text-blue-300">to</span>
          <input
            type="date"
            name="endDate"
            value={form.endDate}
            onChange={handleChange}
            placeholder="End Date (Optional)"
            className="border border-[#232945] bg-[#141a21] text-white rounded-lg p-3 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>

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

      {/* Row 2: Button */}
      <div className="flex flex-wrap gap-4 items-center justify-end mt-2">
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

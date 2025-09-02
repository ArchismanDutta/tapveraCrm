import React, { useEffect, useState } from "react";
import axios from "axios";
import HolidayTable from "../components/manageholiday/HolidayTable";
import HolidayForm from "../components/manageholiday/HolidayForm";


const HolidayManagementPage = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch holidays
  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/holidays"); // backend route
      setHolidays(res.data);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    } finally {
      setLoading(false);
    }
  };

  // Add holiday
  const addHoliday = async (holidayData) => {
    try {
      const res = await axios.post("/api/holidays", holidayData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setHolidays((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Error creating holiday:", err);
    }
  };

  // Delete holiday
  const deleteHoliday = async (id) => {
    try {
      await axios.delete(`/api/holidays/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setHolidays((prev) => prev.filter((h) => h._id !== id));
    } catch (err) {
      console.error("Error deleting holiday:", err);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Holiday Management</h1>
      <HolidayForm onAdd={addHoliday} />
      {loading ? (
        <p>Loading holidays...</p>
      ) : (
        <HolidayTable holidays={holidays} onDelete={deleteHoliday} />
      )}
    </div>
  );
};

export default HolidayManagementPage;

import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const WorkHoursChart = ({ dailyData }) => {
  if (!dailyData || dailyData.length === 0)
    return <p className="text-gray-400">No work hour data available.</p>;

  // Map days labeled as "DD" and hours (converted from seconds)
  const chartData = dailyData.map(day => ({
    day: new Date(day.date).getDate(),
    hours: (day.workDurationSeconds || 0) / 3600,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="day" label={{ value: "Day", position: "insideBottom", offset: -20 }} />
        <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Bar dataKey="hours" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default WorkHoursChart;

// File: components/dashboard/WorkHoursChart.jsx
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const WorkHoursChart = ({ dailyData = [] }) => {
  if (!dailyData || dailyData.length === 0) {
    return (
      <p className="text-gray-400 italic">
        No work hour data available for the selected period.
      </p>
    );
  }

  // Prepare chart data: day label and hours worked
  const chartData = dailyData.map((day) => {
    const dateObj = day?.date ? new Date(day.date) : null;
    const dayLabel = dateObj ? dateObj.getDate() : "-";
    const hours = ((day?.workDurationSeconds || 0) / 3600).toFixed(2);
    return { day: dayLabel, hours: parseFloat(hours) };
  });

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow mb-6">
      <h3 className="text-white font-semibold mb-4">Daily Work Hours</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 10, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="day"
            label={{ value: "Day", position: "insideBottom", offset: -20, fill: "#fff" }}
            stroke="#ccc"
          />
          <YAxis
            label={{
              value: "Hours",
              angle: -90,
              position: "insideLeft",
              fill: "#fff",
            }}
            stroke="#ccc"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              borderRadius: "6px",
              border: "none",
              color: "#fff",
            }}
            formatter={(value) => `${value} hr`}
          />
          <Bar
            dataKey="hours"
            fill="#ab4ee1"
            radius={[4, 4, 0, 0]}
            minPointSize={2}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Default props for safety
WorkHoursChart.defaultProps = {
  dailyData: [],
};

export default WorkHoursChart;

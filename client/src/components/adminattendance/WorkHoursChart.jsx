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

const WorkHoursChart = ({
  dailyData = [],
  gradientColors = ["#f19ad2", "#ab4ee1", "#9743c8"],
}) => {
  if (!dailyData || dailyData.length === 0) {
    return (
      <p className="text-gray-400 italic text-center py-4">
        No work hour data available.
      </p>
    );
  }

  // Prepare chart data
  const chartData = dailyData.map((day) => {
    const dateObj = day?.date ? new Date(day.date) : null;
    const dayLabel = dateObj ? dateObj.getDate() : "-";
    const hours = ((day?.workDurationSeconds || 0) / 3600).toFixed(1); // smaller decimals
    return { day: dayLabel, hours: parseFloat(hours) };
  });

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md mb-6">
      <h3 className="text-white font-semibold mb-2 text-base">
        Daily Work Hours
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <defs>
            <linearGradient id="workGradient" x1="0" y1="0" x2="0" y2="1">
              {gradientColors.map((color, index) => (
                <stop
                  key={index}
                  offset={`${(index / (gradientColors.length - 1)) * 100}%`}
                  stopColor={color}
                  stopOpacity={1}
                />
              ))}
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="#ccc"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            stroke="#ccc"
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={30}
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
          <Bar dataKey="hours" fill="url(#workGradient)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

WorkHoursChart.defaultProps = {
  dailyData: [],
  gradientColors: ["#f19ad2", "#ab4ee1", "#9743c8"],
};

export default WorkHoursChart;

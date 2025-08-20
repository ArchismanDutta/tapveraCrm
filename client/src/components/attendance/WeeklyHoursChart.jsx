// WeeklyHoursChart.jsx
import React, { useState } from "react";

const WeeklyHoursChart = ({ weeklyHours }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Find max hours for y-axis scale, default min 12 for good visual scale
  const maxHours = Math.max(...weeklyHours.map((d) => d.hours), 12);
  const scaleMax = Math.ceil(maxHours) + 1;

  const chartHeight = 150;
  const barWidth = 30;
  const barGap = 20;
  const svgWidth = weeklyHours.length * (barWidth + barGap);

  return (
    <div className="bg-white rounded-xl shadow-md p-4 w-full">
      <h3 className="font-semibold text-lg mb-4">Weekly Hours</h3>
      <svg
        width={svgWidth}
        height={chartHeight + 40}
        role="img"
        aria-label="Weekly hours bar chart"
      >
        {/* Horizontal grid lines */}
        {[...Array(scaleMax).keys()].map((i) => (
          <line
            key={i}
            x1={0}
            y1={(chartHeight / scaleMax) * i}
            x2={svgWidth}
            y2={(chartHeight / scaleMax) * i}
            stroke="#e2e8f0"
            strokeDasharray="4"
          />
        ))}

        {/* Bars with labels and tooltips */}
        {weeklyHours.map((data, index) => {
          const barHeight = (data.hours / scaleMax) * chartHeight;
          const x = index * (barWidth + barGap);
          const y = chartHeight - barHeight;
          return (
            <g key={data.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={index === hoveredIndex ? "#2563eb" : "#3b82f6"}
                rx={4}
                ry={4}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {index === hoveredIndex && (
                <text
                  x={x + barWidth / 2}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#111827"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {data.hours} h
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 20}
                textAnchor="middle"
                fontSize="12"
                fill="#6b7280"
              >
                {data.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default WeeklyHoursChart;

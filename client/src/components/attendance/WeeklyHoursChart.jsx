import React, { useState } from "react";

const WeeklyHoursChart = ({ weeklyHours }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Max hours for scale - min 12 for visuals
  const maxHours = Math.max(...weeklyHours.map((d) => d.hours), 12);
  const scaleMax = Math.ceil(maxHours) + 1;

  const chartHeight = 150;
  const barWidth = 30;
  const barGap = 20;
  const svgWidth = weeklyHours.length * (barWidth + barGap);

  return (
    <div className="bg-[#161c2c] rounded-xl shadow-md p-4 w-full border border-[#232945]">
      <h3 className="font-semibold text-lg mb-4 text-gray-100">Weekly Hours</h3>
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
            stroke="#374151"
            strokeDasharray="4"
          />
        ))}

        {/* Bars */}
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
                fill={index === hoveredIndex ? "#f97316" : "#fb923c"}
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
                  fill="#fbbf24"
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
                fill="#9ca3af"
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

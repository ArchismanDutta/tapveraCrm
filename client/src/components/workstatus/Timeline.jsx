import React from "react";

const Timeline = ({ timeline }) => (
  <div className="bg-[#161c2c] p-4 rounded-xl shadow-md w-full border border-[#232945]">
    <h3 className="font-semibold mb-2 text-lg text-gray-100">Today's Timeline</h3>
    <ul className="space-y-1">
      {timeline.map((item, index) => (
        <li key={index} className="flex justify-between text-gray-200">
          <span>{item.type}</span>
          <span className="text-orange-400">{item.time}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default Timeline;

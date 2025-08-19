import React from "react";

const Timeline = ({ timeline }) => (
  <div className="bg-white p-4 rounded shadow-md">
    <h3 className="font-semibold mb-2">Today's Timeline</h3>
    <ul className="space-y-1">
      {timeline.map((item, index) => (
        <li key={index} className="flex justify-between">
          <span>{item.type}</span>
          <span>{item.time}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default Timeline;

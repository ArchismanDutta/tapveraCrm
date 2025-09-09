import React from "react";

const COLORS = [
  "bg-cyan-700",
  "bg-indigo-700",
  "bg-pink-600",
  "bg-orange-600",
  "bg-green-700",
  "bg-purple-700",
  "bg-teal-700",
  "bg-blue-800",
  "bg-yellow-700"
];

const QualificationsSkills = ({ info }) => (
  <div className="p-6 rounded-2xl shadow-md border border-[#283255] bg-[#181f34] text-blue-100">
    <h3 className="text-xl font-bold text-cyan-300 mb-6 flex items-center gap-2">
      <span role="img" aria-label="Qual">🎓</span> Qualifications & Skills
    </h3>
    <div className="mb-7">
      <span className="block text-md font-bold mb-1">Education:</span>
      {info.education && info.education.length > 0 ? (
        <ul className="list-disc pl-6 text-cyan-200 space-y-1">
          {info.education.map((q, idx) => (
            <li key={idx}>
              {q.degree || "N/A"} - {q.school || "N/A"} ({q.year || "N/A"})
              {q.marks ? ` | Marks: ${q.marks}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <div className="pl-2 py-1 text-blue-400">No qualifications available</div>
      )}
    </div>
    <div>
      <span className="block text-md font-bold mb-1">Skills:</span>
      {info.skills && info.skills.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {info.skills.map((s, idx) => (
            <span
              key={idx}
              className={`px-3 py-1 rounded-lg text-white text-sm font-semibold border border-[#334065] ${COLORS[idx % COLORS.length]}`}
            >
              {s}
            </span>
          ))}
        </div>
      ) : (
        <span className="pl-2 py-1 text-blue-400">No skills listed</span>
      )}
    </div>
  </div>
);

export default QualificationsSkills;

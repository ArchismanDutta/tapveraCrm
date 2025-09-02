import React from "react";

const QualificationsSkills = ({ info }) => (
  <div className="p-6 rounded-2xl shadow border border-[#283255] bg-[#181f34] text-blue-100">
    <h3 className="text-xl font-semibold text-blue-300 mb-3">🎓 Qualifications & Skills</h3>

    {/* Qualifications */}
    <div className="mb-3">
      <strong>Education:</strong>
      {info.education && info.education.length > 0 ? (
        <ul className="list-disc ml-6 mt-1">
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

    {/* Skills */}
    <div>
      <strong>Skills:</strong>
      {info.skills && info.skills.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {info.skills.map((s, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-[#24335a] text-blue-200 rounded-full text-sm border border-[#334065]"
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

// QualificationsSkills.jsx
import React from "react";

const QualificationsSkills = ({ info = {} }) => {
  const education = Array.isArray(info.education) ? info.education : [];
  const skills = Array.isArray(info.skills) ? info.skills : [];

  return (
    <div className="border rounded-3xl shadow-2xl p-8 bg-gradient-to-br from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 transition-all duration-400 transform hover:scale-[1.04]">
      <h2 className="text-3xl font-extrabold text-yellow-900 mb-8 tracking-wide">Qualifications & Skills</h2>

      <div className="mb-8">
        <h3 className="text-xl font-semibold text-yellow-800 mb-4 border-b-2 border-yellow-400 pb-1">Education</h3>
        {education.length > 0 ? (
          <ul className="list-disc list-inside text-yellow-900 space-y-2">
            {education.map((edu, idx) => (
              <li key={idx} className="text-lg font-medium">{edu}</li>
            ))}
          </ul>
        ) : (
          <p className="text-yellow-600 italic">N/A</p>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold text-yellow-800 mb-4 border-b-2 border-yellow-400 pb-1">Skills</h3>
        {skills.length > 0 ? (
          <ul className="list-disc list-inside text-yellow-900 space-y-2">
            {skills.map((skill, idx) => (
              <li key={idx} className="text-lg font-medium">{skill}</li>
            ))}
          </ul>
        ) : (
          <p className="text-yellow-600 italic">N/A</p>
        )}
      </div>
    </div>
  );
};

export default QualificationsSkills;

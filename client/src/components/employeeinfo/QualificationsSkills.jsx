import React from "react";

const QualificationsSkills = ({ info = {} }) => {
  const education = Array.isArray(info.education) ? info.education : [];
  const skills = Array.isArray(info.skills) ? info.skills : [];

  return (
    <div
      className="border border-yellow-600 rounded-3xl shadow-xl p-8
                 bg-gradient-to-br from-yellow-950/10 to-yellow-900/10
                 hover:from-yellow-900/20 hover:to-yellow-850/20
                 transition-colors duration-300 transform hover:scale-105"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <h2 className="text-3xl font-extrabold text-yellow-800 mb-8 tracking-wide drop-shadow-sm">
        Qualifications &amp; Skills
      </h2>

      <div className="mb-9">
        <h3 className="text-xl font-semibold text-yellow-700 mb-3 border-b-2 border-yellow-400 pb-1">
          Education
        </h3>
        {education.length > 0 ? (
          <ul className="list-disc list-inside text-yellow-700 space-y-2">
            {education.map((edu, idx) => (
              <li key={idx} className="text-lg font-medium">
                {edu}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-yellow-600 italic">N/A</p>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold text-yellow-700 mb-3 border-b-2 border-yellow-400 pb-1">
          Skills
        </h3>
        {skills.length > 0 ? (
          <ul className="list-disc list-inside text-yellow-700 space-y-2">
            {skills.map((skill, idx) => (
              <li key={idx} className="text-lg font-medium">
                {skill}
              </li>
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

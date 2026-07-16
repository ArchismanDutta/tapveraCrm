import React from "react";

const skillClasses = [
  "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
];

const QualificationsSkills = ({ info }) => (
  <div className="app-panel rounded-2xl p-5">
    <p className="app-eyebrow">Growth</p>
    <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Qualifications & Skills</h3>

    <div className="mt-5">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Education</h4>
      {info.education && info.education.length > 0 ? (
        <div className="mt-3 grid gap-3">
          {info.education.map((qualification, index) => (
            <div key={`${qualification.degree || "degree"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{qualification.degree || "N/A"}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {qualification.school || "N/A"} ({qualification.year || "N/A"})
                {qualification.marks ? ` · Marks: ${qualification.marks}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No qualifications available
        </div>
      )}
    </div>

    <div className="mt-6">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Skills</h4>
      {info.skills && info.skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {info.skills.map((skill, index) => (
            <span
              key={`${skill}-${index}`}
              className={`rounded-lg border px-3 py-1 text-sm font-semibold ${skillClasses[index % skillClasses.length]}`}
            >
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No skills listed
        </div>
      )}
    </div>
  </div>
);

export default QualificationsSkills;

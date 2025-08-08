import React, { useState } from "react";
import { Edit, Save, X } from "lucide-react";

// Slightly softened palette
const colors = {
  primary: "#a76f45",
  deepOrange: "#b54827",
  warmBrown: "#a17854",
  mutedBrown: "#96765b",
  earthyOlive: "#97925f",
  darkOlive: "#59522b",
  black: "#28221d",
  background: "linear-gradient(135deg, #fcfaf7 60%, #f5ede6 100%)",
  border: "#ebe3db"
};

const ProfileDetails = ({ details, avatarUrl, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState(details);

  const handleChange = (index, value) => {
    const updated = [...formValues];
    updated[index].value = value;
    setFormValues(updated);
  };

  const handleSave = () => {
    setIsEditing(false);
    if (onSave) onSave(formValues);
  };

  return (
    <div
      className="rounded-xl shadow-md px-8 py-7 transition-all duration-300"
      style={{
        background: colors.background,
        border: `1px solid ${colors.border}`,
        maxWidth: 560,
        margin: "0 auto"
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between mb-7 pb-2 border-b"
        style={{ borderColor: colors.border }}
      >
        <h2
          className="text-lg font-semibold tracking-wide"
          style={{ color: colors.primary, letterSpacing: "0.01em" }}
        >
          Personal Details
        </h2>
        {!isEditing ? (
          <button
            className="flex items-center gap-1 text-sm font-medium px-2 py-1 rounded hover:bg-[#f7f3ee] transition-colors"
            style={{
              color: colors.deepOrange,
              border: `1px solid ${colors.border}`,
            }}
            onClick={() => setIsEditing(true)}
          >
            <Edit size={16} /> Edit
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              className="flex items-center gap-1 px-3 py-1 text-sm rounded hover:opacity-90 transition"
              style={{
                backgroundColor: colors.earthyOlive,
                color: "#fff",
                boxShadow: "0 1px 6px 0 rgba(150, 130, 60, .06)",
              }}
              onClick={handleSave}
            >
              <Save size={16} /> Save
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1 text-sm rounded hover:opacity-90 transition"
              style={{
                backgroundColor: colors.darkOlive,
                color: "#fff",
                boxShadow: "0 1px 6px 0 rgba(90,80,40, .05)",
              }}
              onClick={() => {
                setIsEditing(false);
                setFormValues(details);
              }}
            >
              <X size={16} /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Profile Picture and Name */}
      <div className="flex items-center gap-3 mb-7">
        <img
          src={avatarUrl || "https://via.placeholder.com/80"}
          alt="Profile"
          className="w-20 h-20 rounded-full border-2 object-cover shadow"
          style={{
            borderColor: colors.primary,
            backgroundColor: "#f9f6f2",
            boxShadow: "0 2px 14px -5px #ccbfb2"
          }}
        />
        <div>
          <p
            className="font-semibold text-lg leading-tight"
            style={{ color: colors.black }}
          >
            {formValues[0]?.value}
          </p>
          <p
            className="text-sm"
            style={{ color: colors.warmBrown, fontWeight: 500 }}
          >
            {formValues[1]?.value}
          </p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-7 text-sm">
        {formValues.map((item, idx) => (
          <div key={idx}>
            <p
              className="uppercase text-xs font-medium mb-1"
              style={{
                color: colors.mutedBrown,
                letterSpacing: ".02em"
              }}
            >
              {item.label}
            </p>
            {isEditing ? (
              <input
                type="text"
                value={item.value}
                onChange={(e) => handleChange(idx, e.target.value)}
                className="w-full rounded px-2 py-1 outline-none transition focus:ring-2 focus:ring-[#ede3da] border"
                style={{
                  border: `1px solid ${colors.warmBrown}`,
                  color: colors.black,
                  background: "#fff9f3",
                  fontWeight: 500,
                  fontSize: "1rem"
                }}
              />
            ) : (
              <p
                className="font-medium min-h-[28px] py-[2px] tracking-tight"
                style={{ color: colors.black }}
              >
                {item.value}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileDetails;

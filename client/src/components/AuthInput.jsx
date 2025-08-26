import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const AuthInput = ({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder = "",
  autoComplete = "off",
  required = false,
  error = "",
  showTogglePassword = false,
  icon: Icon,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  // Determine actual input type based on toggle
  const inputType = showTogglePassword && showPassword ? "text" : type;

  const inputId = `auth-input-${name}`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="w-full">
      {/* Label */}
      <label htmlFor={inputId} className="block text-sm text-blue-200 mb-1 font-semibold">
        {label}
        {required && " *"}
      </label>

      <div className="relative w-full">
        {/* Optional left icon */}
        {Icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white pointer-events-none">
            <Icon />
          </div>
        )}

        {/* Input field */}
        <input
          id={inputId}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={errorId}
          className={`w-full px-4 py-2 rounded-md bg-[#141a29] border ${
            error ? "border-red-500" : "border-white"
          } text-white placeholder-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ff8000] focus:border-[#ff8000] transition ${
            Icon ? "pl-10" : ""
          } ${showTogglePassword ? "pr-10" : ""}`}
        />

        {/* Password toggle button */}
        {showTogglePassword && type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-[#ff9500] transition focus:outline-none focus:ring-2 focus:ring-[#ff8000] rounded"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-500 font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default AuthInput;

import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const AuthInput = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder = '',
  autoComplete = 'off',
  required = false,
  error = '',
  showTogglePassword = false,
  icon: Icon,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  // Determine the actual input type
  const inputType = showTogglePassword && showPassword ? 'text' : type;

  const inputId = `auth-input-${name}`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="w-full">
      {/* Label */}
      <label htmlFor={inputId} className="block text-sm text-textMuted mb-1">
        {label}{required && ' *'}
      </label>

      <div className="relative w-full">
        {/* Optional left icon */}
        {Icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-textMuted pointer-events-none">
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
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={errorId}
          className={`w-full px-4 py-2 rounded-md bg-background border 
            ${error ? 'border-red-500' : 'border-border'} text-textMain 
            placeholder:text-textMuted focus:outline-none focus:border-primary transition
            ${Icon ? 'pl-10' : ''} ${showTogglePassword ? 'pr-10' : ''}`}
        />

        {/* Password toggle button */}
        {showTogglePassword && type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default AuthInput;

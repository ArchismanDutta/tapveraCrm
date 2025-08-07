import React, { useState } from 'react';
import PropTypes from 'prop-types';
import AuthInput from '../components/AuthInput';
import tapveraLogo from '../assets/tapvera.png';

// Import icons
import { FaUser, FaEnvelope, FaPhone, FaLock } from 'react-icons/fa';

const Signup = ({ onSignupSuccess }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    contact: '',
    dob: '',
    gender: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      setLoading(false);
      const isIncomplete = Object.values(form).some((value) => !value);
      if (isIncomplete) {
        setError('Please fill in all fields.');
        return;
      }

      onSignupSuccess();
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-6">
      <img src={tapveraLogo} alt="Tapvera Logo" className="h-20 w-auto mb-6" />

      <div className="bg-surface rounded-xl shadow-lg shadow-[0_0_15px_rgba(255,153,0,0.4)] border border-border p-6 w-full max-w-lg">
        <h2 className="text-2xl font-bold text-textMain mb-5 text-center">
          Create an account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <AuthInput
            label="Full Name"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            required
            error={error && !form.name ? 'Full Name is required.' : ''}
            icon={FaUser}
          />

          <AuthInput
            label="Email Address"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
            autoComplete="email"
            required
            error={error && !form.email ? 'Email is required.' : ''}
            icon={FaEnvelope}
          />

          <AuthInput
            label="Contact Number"
            type="tel"
            name="contact"
            value={form.contact}
            onChange={handleChange}
            placeholder="Enter your contact number"
            autoComplete="tel"
            required
            error={error && !form.contact ? 'Contact number is required.' : ''}
            icon={FaPhone}
          />

          {/* Date of Birth */}
          <div>
            <label htmlFor="dob" className="block text-sm text-textMuted mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              id="dob"
              name="dob"
              value={form.dob}
              onChange={handleChange}
              required
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-2 rounded-md bg-background border ${
                error && !form.dob ? 'border-red-500' : 'border-border'
              } text-textMain placeholder:text-textMuted focus:outline-none focus:border-primary transition`}
            />
            {error && !form.dob && (
              <p className="mt-1 text-xs text-red-500">Date of Birth is required.</p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label htmlFor="gender" className="block text-sm text-textMuted mb-1">
              Gender *
            </label>
            <select
              id="gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              required
              className={`w-full px-4 py-2 rounded-md bg-background border ${
                error && !form.gender ? 'border-red-500' : 'border-border'
              } text-textMain placeholder:text-textMuted focus:outline-none focus:border-primary transition`}
            >
              <option value="" disabled>
                Select your gender
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="preferNotToSay">Prefer not to say</option>
            </select>
            {error && !form.gender && (
              <p className="mt-1 text-xs text-red-500">Please select your gender.</p>
            )}
          </div>

          <AuthInput
            label="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a password"
            autoComplete="new-password"
            required
            error={error && !form.password ? 'Password is required.' : ''}
            showTogglePassword={true}
            icon={FaLock}
          />

          {error && (
            <div className="text-sm text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-yellow-300 hover:bg-orange-500 hover:text-white transition text-background font-semibold shadow focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-4 text-center text-textMuted text-sm">
          Already have an account?{' '}
          <a href="/login" className="text-primary hover:text-orangeDark">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
};

Signup.propTypes = {
  onSignupSuccess: PropTypes.func.isRequired,
};

export default Signup;

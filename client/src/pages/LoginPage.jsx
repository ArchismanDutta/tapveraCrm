import React, { useState } from 'react';
import PropTypes from 'prop-types';
import AuthInput from '../components/AuthInput';
import tapveraLogo from '../assets/tapvera.png';

// Icons
import { FaEnvelope, FaLock } from 'react-icons/fa';

const Login = ({ onLoginSuccess }) => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      setLoading(false);
      if (form.email !== 'admin@company.com' || form.password !== 'password') {
        setError('Invalid email or password.');
      } else {
        onLoginSuccess();
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      {/* Logo */}
      <img src={tapveraLogo} alt="Tapvera Logo" className="h-24 w-auto mb-6" />

      <div className="bg-surface rounded-xl shadow-lg shadow-[0_0_15px_rgba(255,153,0,0.4)] p-8 w-full max-w-md border border-border">
        <h2 className="text-2xl font-bold text-textMain mb-6 text-center">
          Log in to your account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <AuthInput
            label="Email Address"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
            autoComplete="username"
            required
            error={error && !form.email ? 'Email is required.' : ''}
            icon={FaEnvelope}
          />

          <AuthInput
            label="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            error={error && !form.password ? 'Password is required.' : ''}
            showTogglePassword={true}
            icon={FaLock}
          />

          {error && form.email && form.password && (
            <div className="text-sm text-red-500 bg-background border border-red-700 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-yellow-300 hover:bg-orange-500 transition text-background font-semibold shadow focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-textMuted text-sm">
            Forgot your password?
            <a href="/reset-password" className="ml-2 text-secondary hover:underline">
              Reset
            </a>
          </span>
        </div>

        <p className="mt-4 text-center text-textMuted text-sm">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-primary hover:text-orangeDark">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
};

Login.propTypes = {
  onLoginSuccess: PropTypes.func.isRequired,
};

export default Login;

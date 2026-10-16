import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/^0+/, '')}`;
      await login(formattedPhone, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img
            src="/teabhatti-logo.png"
            alt="Tea Bhatti"
            className="w-20 h-20 rounded-3xl mx-auto mb-4 object-contain shadow-lg border-2 border-border-subtle bg-white p-1.5"
          />
          <h1 className="text-3xl font-heading font-black text-text-primary tracking-tight">Tea Bhatti</h1>
          <p className="text-text-secondary mt-1 text-xs font-semibold uppercase tracking-wider">Owner Dashboard Portal</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Phone Number</label>
              <div className="flex gap-2">
                <span className="input-field w-16 text-center bg-bg-subtle">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  required
                  className="input-field flex-1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-field"
              />
            </div>
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-button text-sm text-error">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div className="mt-6 pt-4 border-t border-border-subtle text-center text-xs text-text-secondary flex items-center justify-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Authorized Owner Access Only · Fixed Portal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delivery Partner Signup Page ──
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bike, Shield, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../lib/api.js';

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    businessId: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch available businesses for the dropdown
    apiFetch('/auth/businesses')
      .then(data => setBusinesses(data))
      .catch(err => console.error('Failed to load businesses:', err));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    if (!form.businessId) {
      setError('Please select a cafe to partner with.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        phone: '+91' + form.phone,
        password: form.password,
        businessId: form.businessId
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-main flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
            <Bike className="w-8 h-8 text-white -rotate-3" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-heading font-bold text-text-primary">
          Join the Fleet
        </h2>
        <p className="mt-2 text-center text-sm text-text-secondary">
          Sign up to start delivering for your local cafe
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="card p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-lg bg-error/10 text-error text-sm font-medium border border-error/20 flex items-start gap-2 animate-fade-in">
                <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="Ravi Kumar"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-text-secondary font-medium">+91</span>
                </div>
                <input
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="input-field pl-12"
                  placeholder="9876543210"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Partner Cafe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Store className="w-4 h-4 text-text-secondary" />
                </div>
                <select
                  required
                  value={form.businessId}
                  onChange={e => setForm({ ...form, businessId: e.target.value })}
                  className="input-field pl-10 appearance-none"
                >
                  <option value="" disabled>Select a cafe to partner with</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.address})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-4 font-semibold text-lg"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-text-secondary border-t border-border-color pt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

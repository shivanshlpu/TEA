import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@cafeos/ui';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await login(phone, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-border-subtle p-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🛵</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Delivery Partner</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-color-error rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Phone Number</label>
            <div className="flex gap-2">
              <span className="px-3 py-2 border border-border-subtle rounded-lg bg-bg-base text-text-secondary text-sm font-medium flex items-center">+91</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-4 py-2 border border-border-subtle rounded-lg focus:outline-none focus:border-primary flex-1"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-border-subtle rounded-lg focus:outline-none focus:border-primary"
              required
            />
          </div>

          <Button type="submit" variant="primary" className="w-full py-3 mt-4">
            Login to CafeOS
          </Button>
        </form>
        
        <div className="mt-6 text-center text-sm text-text-secondary border-t border-border-subtle pt-6">
          Want to deliver for a cafe?{' '}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            Join the Fleet
          </Link>
        </div>
      </div>
    </div>
  );
}

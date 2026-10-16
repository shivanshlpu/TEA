import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    businessName: '',
    industryType: 'cafe',
    address: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { registerOwner } = useAuth();
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formattedPhone = formData.phone.startsWith('+91') 
        ? formData.phone 
        : `+91${formData.phone.replace(/^0+/, '')}`;
        
      await registerOwner({
        ...formData,
        phone: formattedPhone
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Join CafeOS</h1>
          <p className="text-text-secondary mt-2">Create your owner account & business profile</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Owner Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-text-primary border-b border-border-color pb-2">1. Your Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Full Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required className="input-field" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Phone Number</label>
                  <div className="flex gap-2">
                    <span className="input-field w-16 text-center bg-bg-subtle">+91</span>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="input-field flex-1" placeholder="9876543210" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} required minLength="6" className="input-field" placeholder="••••••••" />
              </div>
            </div>

            {/* Business Details */}
            <div className="space-y-4 pt-2">
              <h3 className="font-semibold text-text-primary border-b border-border-color pb-2">2. Business Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Business Name</label>
                  <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} required className="input-field" placeholder="My Cafe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Industry Type</label>
                  <select name="industryType" value={formData.industryType} onChange={handleChange} className="input-field">
                    <option value="cafe">Cafe</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="bakery">Bakery</option>
                    <option value="cloud_kitchen">Cloud Kitchen</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Complete Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} required rows="2" className="input-field" placeholder="Street, City, State, PIN" />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-button text-sm text-error">
                {error}
              </div>
            )}
            
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          <div className="mt-6 text-center text-sm text-text-secondary">
            Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Sign in here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

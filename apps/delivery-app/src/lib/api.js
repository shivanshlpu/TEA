const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('cafeos_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'API Request Failed');
  }

  return data;
}

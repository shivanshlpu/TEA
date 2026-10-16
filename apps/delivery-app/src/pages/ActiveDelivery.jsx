import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Button, Card } from '@cafeos/ui';
import { ChevronLeft, CheckCircle, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet's default icon path issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to auto-center map
function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, 15);
    }
  }, [position, map]);
  return null;
}

export default function ActiveDelivery() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [routeData, setRouteData] = useState(null);
  const [myLocation, setMyLocation] = useState([12.9716, 77.5946]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchRoute();
  }, [orderId]);

  useEffect(() => {
    // Start tracking location via browser GPS if available
    let watchId;
    if ('geolocation' in navigator && !simulating) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMyLocation([lat, lng]);
          updateLocationOnServer(lat, lng);
        },
        (err) => console.error('GPS error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [orderId, simulating]);

  // Simulation movement loop for testing
  useEffect(() => {
    let interval;
    if (simulating) {
      interval = setInterval(() => {
        setMyLocation(([lat, lng]) => {
          const newLat = lat + 0.0003;
          const newLng = lng + 0.0004;
          updateLocationOnServer(newLat, newLng);
          return [newLat, newLng];
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [simulating]);

  const fetchRoute = async () => {
    try {
      const data = await apiFetch(`/delivery/${orderId}/route`);
      setRouteData(data);
      // Auto-update status to out_for_delivery if it isn't already
      await apiFetch(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'out_for_delivery' })
      });
      // Post initial location
      updateLocationOnServer(12.9716, 77.5946);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateLocationOnServer = async (lat, lng) => {
    try {
      await apiFetch(`/delivery/${orderId}/location`, {
        method: 'PATCH',
        body: JSON.stringify({ lat, lng }),
      });
    } catch (err) {
      console.error('Failed to post location to server', err);
    }
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  const executeCompleteDelivery = async () => {
    setShowConfirmModal(false);
    setDeliveryError('');
    try {
      await apiFetch(`/delivery/${orderId}/complete`, { method: 'PATCH' });
      navigate('/');
    } catch (err) {
      setDeliveryError(err.message || 'Failed to complete delivery');
    }
  };

  if (loading) return <div className="p-4 text-center mt-20">Loading route...</div>;
  if (!routeData) return <div className="p-4 text-center mt-20 text-color-error">Failed to load route.</div>;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="bg-white border-b border-border-subtle p-4 flex items-center justify-between shrink-0 z-20 shadow-sm relative">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1 -ml-1 text-text-secondary">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-heading font-bold text-lg text-text-primary">Delivery #{orderId.split('-')[0].toUpperCase()}</h1>
        </div>
        <button
          onClick={() => setSimulating(!simulating)}
          className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${
            simulating ? 'bg-error text-white animate-pulse' : 'bg-primary text-white'
          }`}
        >
          {simulating ? '⏸ Pause GPS Sim' : '▶ Simulate GPS Ride'}
        </button>
      </header>

      <div className="flex-1 relative z-0">
        <MapContainer 
          center={myLocation || [12.9716, 77.5946]} 
          zoom={15} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {myLocation && (
            <Marker position={myLocation}>
              <Popup>Delivery Partner (Live)</Popup>
            </Marker>
          )}
          <MapUpdater position={myLocation} />
        </MapContainer>
      </div>

      <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-5 shrink-0 z-20 relative">
        <div className="w-12 h-1 bg-border-subtle rounded-full mx-auto mb-4"></div>
        
        <h2 className="font-bold text-lg text-text-primary mb-1">{routeData.customer?.user?.name || 'Customer'}</h2>
        <p className="text-sm text-text-secondary mb-4">{routeData.deliveryAddress}</p>
        
        <div className="flex gap-2 mb-4">
          <Button 
            variant="outline" 
            className="flex-1 flex items-center justify-center gap-2"
            onClick={() => window.open(`tel:${routeData.customer?.user?.phone}`)}
          >
            Call
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 flex items-center justify-center gap-2"
            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(routeData.deliveryAddress)}`)}
          >
            <Navigation size={16} /> Maps
          </Button>
        </div>

        {deliveryError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
            {deliveryError}
          </div>
        )}

        <Button 
          variant="primary" 
          className="w-full py-4 text-lg font-bold flex items-center justify-center gap-2"
          onClick={() => setShowConfirmModal(true)}
        >
          <CheckCircle size={20} /> Complete Delivery
        </Button>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-border-subtle text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">Mark as Delivered?</h3>
            <p className="text-sm text-text-secondary mb-6">Are you sure you want to mark this delivery order as completed?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 border border-border-subtle rounded-xl font-bold text-text-secondary hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                onClick={executeCompleteDelivery}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:brightness-105"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

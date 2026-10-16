import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Badge } from '@cafeos/ui';
import { LogOut, MapPin, Phone } from 'lucide-react';

export default function AssignedOrders() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Polling for now
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await apiFetch('/delivery/assigned');
      setOrders(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <header className="bg-white border-b border-border-subtle p-4 sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="font-heading font-bold text-xl text-text-primary">Deliveries</h1>
          <p className="text-sm text-text-secondary">{user.name}</p>
        </div>
        <button onClick={logout} className="p-2 text-text-secondary hover:bg-bg-base rounded-full">
          <LogOut size={20} />
        </button>
      </header>

      <main className="p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <div className="text-4xl mb-4">☕</div>
            <p>No active deliveries right now.</p>
            <p className="text-sm">Grab a coffee and wait for assignments.</p>
          </div>
        ) : (
          orders.map(order => (
            <Card key={order.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-text-primary">#{order.id.split('-')[0].toUpperCase()}</h3>
                  <p className="text-sm text-text-secondary">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <Badge 
                  variant={order.status === 'ready' ? 'warning' : 'success'} 
                  text={order.status === 'ready' ? 'Ready at Cafe' : 'Out for Delivery'} 
                />
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-3">
                  <MapPin className="text-primary mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-semibold">Pickup: {order.business.name}</p>
                    <p className="text-xs text-text-secondary">{order.business.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="text-color-success mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="text-sm font-semibold">Drop: {order.customer.user.name}</p>
                    <p className="text-xs text-text-secondary">{order.deliveryAddress}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 flex items-center justify-center gap-2"
                  onClick={() => window.open(`tel:${order.customer.user.phone}`)}
                >
                  <Phone size={16} /> Call
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1"
                  onClick={() => navigate(`/delivery/${order.id}`)}
                >
                  {order.status === 'ready' ? 'Start Delivery' : 'View Map'}
                </Button>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}

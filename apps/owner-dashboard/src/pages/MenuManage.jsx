// ── Menu Management Page ──
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, CheckCircle2, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function MenuManage() {
  const { apiFetch, user } = useAuth();
  const { toast, confirm } = useToast();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', categoryId: '', isVeg: true, discountPct: 0, imageUrl: '' });

  useEffect(() => { loadData(); }, []);

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = await apiFetch('/upload', {
          method: 'POST',
          body: { image: event.target.result, filename: file.name }
        });
        setForm(prev => ({ ...prev, imageUrl: data.url }));
        toast.success('Image uploaded successfully');
      } catch (err) {
        toast.error('Upload failed: ' + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [menuData, cats] = await Promise.all([
        apiFetch(`/menu?businessId=${user.businessId}`),
        apiFetch(`/categories?businessId=${user.businessId}`),
      ]);
      setItems(menuData.items);
      setCategories(cats);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const body = { ...form, price: parseFloat(form.price), discountPct: parseFloat(form.discountPct) || 0 };
    try {
      if (editingItem) {
        await apiFetch(`/menu/${editingItem.id}`, { method: 'PUT', body });
        toast.success(`"${body.name}" updated successfully`);
      } else {
        await apiFetch('/menu', { method: 'POST', body });
        toast.success(`"${body.name}" added to menu`);
      }
      setShowForm(false);
      setEditingItem(null);
      setForm({ name: '', description: '', price: '', categoryId: '', isVeg: true, discountPct: 0, imageUrl: '' });
      loadData();
    } catch (err) { toast.error(err.message || 'Failed to save item'); }
  }

  async function deleteItem(id) {
    const ok = await confirm({
      title: 'Delete Menu Item?',
      message: 'Are you sure you want to remove this item from the cafe menu?',
      confirmText: 'Delete Item',
      isDestructive: true,
    });
    if (!ok) return;

    try {
      await apiFetch(`/menu/${id}`, { method: 'DELETE' });
      toast.success('Menu item deleted');
      loadData();
    } catch (err) { toast.error(err.message || 'Failed to delete item'); }
  }

  async function toggleAvailability(id) {
    try {
      await apiFetch(`/menu/${id}/availability`, { method: 'PATCH' });
      toast.success('Availability updated');
      loadData();
    } catch (err) { toast.error(err.message || 'Failed to update availability'); }
  }

  function startEdit(item) {
    setEditingItem(item);
    setForm({
      name: item.name, description: item.description || '', price: item.price.toString(),
      categoryId: item.categoryId, isVeg: item.isVeg, discountPct: item.discountPct || 0,
      imageUrl: item.imageUrl || ''
    });
    setShowForm(true);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Menu Management</h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditingItem(null); setForm({ name: '', description: '', price: '', categoryId: categories[0]?.id || '', isVeg: true, discountPct: 0, imageUrl: '' }); }}
          className="btn-primary text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card p-4 sm:p-6 mb-6 animate-slide-up">
          <h2 className="font-heading font-semibold text-lg mb-4">
            {editingItem ? 'Edit Item' : 'New Menu Item'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-1">
              <label className="block text-sm font-medium text-text-primary mb-1">Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="input-field" />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="block text-sm font-medium text-text-primary mb-1">Category</label>
              <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} required className="input-field">
                <option value="">Select...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={2} />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-1">Food Image</label>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <input type="url" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="Paste image link or click upload..." className="input-field flex-1 text-sm" />
                <label className="btn-outline text-xs px-3.5 py-2.5 shrink-0 cursor-pointer inline-flex items-center justify-center gap-1.5 font-semibold hover:bg-bg-subtle">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
              {form.imageUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={form.imageUrl} alt="Preview" className="w-12 h-12 object-cover rounded-button border border-border-subtle" />
                  <span className="text-xs text-success font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Image loaded
                  </span>
                </div>
              )}
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-text-primary mb-1">Price (₹)</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required min="0" step="0.01" className="input-field" />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-text-primary mb-1">Discount %</label>
              <input type="number" value={form.discountPct} onChange={e => setForm({ ...form, discountPct: e.target.value })} min="0" max="100" className="input-field" />
            </div>
            <div className="col-span-1 sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-success bg-success/10 px-3 py-1.5 rounded-badge border border-success/20 w-fit">
              <div className="w-2 h-2 rounded-full bg-success" />
              100% Pure Veg Item
            </div>
            <div className="col-span-1 sm:col-span-2 flex flex-wrap gap-3 pt-2">
              <button type="submit" className="btn-primary text-sm min-h-[40px] px-5">{editingItem ? 'Update' : 'Add Item'}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditingItem(null); }} className="btn-outline text-sm min-h-[40px] px-5">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Menu Items Table */}
      {loading ? (
        <div className="card p-8 text-center text-text-secondary">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-subtle/50">
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Rating</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Available</th>
                  <th className="text-left px-4 py-3 font-semibold text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-border-subtle last:border-0 hover:bg-bg-subtle/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 border-2 ${item.isVeg ? 'border-success' : 'border-error'} rounded-sm flex items-center justify-center shrink-0`}>
                          {item.isVeg ? <div className="w-1.5 h-1.5 bg-success rounded-full" /> : <div className="w-0 h-0" style={{ borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: '5px solid #D64550' }} />}
                        </div>
                        <span className="font-medium text-text-primary">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{item.category?.name}</td>
                    <td className="px-4 py-3 font-bold text-text-primary">
                      ₹{item.price}{item.discountPct > 0 && <span className="text-xs text-success ml-1">-{item.discountPct}%</span>}
                    </td>
                    <td className="px-4 py-3">⭐ {item.rating}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleAvailability(item.id)} className="p-1 text-text-secondary hover:text-primary transition-colors min-h-[36px] min-w-[36px] inline-flex items-center justify-center">
                        {item.isAvailable ? <ToggleRight className="w-6 h-6 text-success" /> : <ToggleLeft className="w-6 h-6 text-text-secondary" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(item)} className="p-2 rounded hover:bg-bg-subtle min-h-[36px] min-w-[36px] inline-flex items-center justify-center" title="Edit"><Edit2 className="w-4 h-4 text-primary" /></button>
                        <button onClick={() => deleteItem(item.id)} className="p-2 rounded hover:bg-error/10 min-h-[36px] min-w-[36px] inline-flex items-center justify-center" title="Delete"><Trash2 className="w-4 h-4 text-error" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <div className="p-8 text-center text-text-secondary">No menu items yet.</div>}
        </div>
      )}
    </div>
  );
}

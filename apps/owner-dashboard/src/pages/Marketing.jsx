// ── Marketing & Automated WhatsApp Campaigns ──
// Swiggy-style marketing campaigns, thank-you notes & promotional posters.
// Features a safe 1.5–3.0 second anti-spam queue.

import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Clock, 
  Image as ImageIcon, 
  Smartphone, 
  RefreshCw, 
  ShieldCheck, 
  FileText 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Marketing() {
  const { apiFetch } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [waStatus, setWaStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Campaign Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audience, setAudience] = useState('test');
  const [testPhone, setTestPhone] = useState('7000748920');

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadCampaignsAndStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  async function loadAll() {
    try {
      const [tplData, campData] = await Promise.all([
        apiFetch('/marketing/templates').catch(() => []),
        apiFetch('/marketing/campaigns').catch(() => ({ campaigns: [] }))
      ]);
      setTemplates(tplData || []);
      setCampaigns(campData?.campaigns || []);
      setWaStatus(campData?.whatsappStatus || null);
    } catch (err) {
      console.error('Failed to load marketing data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCampaignsAndStatus() {
    try {
      const campData = await apiFetch('/marketing/campaigns');
      setCampaigns(campData?.campaigns || []);
      setWaStatus(campData?.whatsappStatus || null);
    } catch (_) {}
  }

  function handleSelectTemplate(tpl) {
    setTitle(tpl.title);
    setMessage(tpl.message);
  }

  async function handleSend(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!message.trim()) {
      setErrorMsg('Please enter a message to send.');
      return;
    }

    setSending(true);

    try {
      const res = await apiFetch('/marketing/campaign', {
        method: 'POST',
        body: {
          title: title.trim() || 'Quick Announcement',
          message: message.trim(),
          imageUrl: imageUrl.trim() || undefined,
          audience,
          testPhone: audience === 'test' ? testPhone.trim() : undefined,
        }
      });

      setSuccessMsg(res.message || 'Campaign successfully added to the dispatch queue!');
      setTitle('');
      setMessage('');
      setImageUrl('');
      await loadCampaignsAndStatus();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch campaign.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="card p-8 text-center animate-pulse text-text-secondary">Loading Marketing Center...</div>;
  }

  return (
    <div className="animate-fade-in max-w-5xl space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-primary" />
            Marketing & WhatsApp Campaigns
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Engage customers with Swiggy-style offers, pickup alerts & posters via automated queue (1.5–3s safe delay).
          </p>
        </div>

        {/* WhatsApp Connection Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {waStatus?.ready ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>WhatsApp Connected ({waStatus.phone || '+91 90091 49694'})</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
              <span>WhatsApp Not Linked (Scan QR in Settings)</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Alerts */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Form & Templates */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Campaign Composer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 shadow-sm border border-border-subtle">
            <h2 className="font-heading font-semibold text-lg text-text-primary mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Compose WhatsApp Campaign
            </h2>

            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Campaign Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekend Chai & Sandwich Special"
                  className="input-field text-xs sm:text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Message Content (WhatsApp Formatted)
                </label>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message here... You can use *bold*, _italics_, and emojis!"
                  className="input-field text-xs sm:text-sm resize-none font-sans"
                  required
                />
                <p className="text-[11px] text-text-secondary mt-1">
                  💡 Tip: Use *text* for bold and emojis to make your message appetizing and eye-catching!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Optional Poster / Food Image URL
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/poster.jpg (Leave empty for text only)"
                      className="input-field text-xs sm:text-sm pl-8"
                    />
                    <ImageIcon className="w-4 h-4 text-text-secondary absolute left-2.5 top-3" />
                  </div>
                </div>
              </div>

              {/* Audience Selector */}
              <div className="p-4 rounded-xl bg-bg-subtle/80 border border-border-subtle space-y-3">
                <label className="block text-xs font-bold text-text-primary">
                  Target Audience
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAudience('test')}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                      audience === 'test'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border-subtle bg-white text-text-secondary hover:bg-bg-subtle'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mb-1 text-primary" />
                    <div>Test Send (1 phone)</div>
                    <div className="text-[10px] text-text-secondary font-normal">Send to owner first</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudience('recent')}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                      audience === 'recent'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border-subtle bg-white text-text-secondary hover:bg-bg-subtle'
                    }`}
                  >
                    <Clock className="w-4 h-4 mb-1 text-primary" />
                    <div>Recent Customers</div>
                    <div className="text-[10px] text-text-secondary font-normal">Recent 20 buyers</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudience('all')}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                      audience === 'all'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                        : 'border-border-subtle bg-white text-text-secondary hover:bg-bg-subtle'
                    }`}
                  >
                    <Users className="w-4 h-4 mb-1 text-primary" />
                    <div>All Customers</div>
                    <div className="text-[10px] text-text-secondary font-normal">All registered users</div>
                  </button>
                </div>

                {audience === 'test' && (
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-text-secondary mb-1">
                      Test Phone Number
                    </label>
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="7000748920"
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                )}
              </div>

              {/* Anti-Spam Queue Notice */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Anti-Spam Throttling: </span>
                  <span>
                    Messages are queued and dispatched with a <strong>1.5 to 3.0 second gap</strong> between each customer. This ensures high deliverability and protects your WhatsApp account.
                  </span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={sending}
                className="btn-primary w-full py-3.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md"
              >
                {sending ? (
                  <span>Queuing Messages...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Launch WhatsApp Campaign</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Swiggy-Style Templates */}
        <div className="space-y-4">
          <div className="card p-5 border border-border-subtle">
            <h3 className="font-heading font-bold text-sm text-text-primary mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" />
              Swiggy-Style Templates
            </h3>
            <p className="text-xs text-text-secondary mb-4">
              Click any template to auto-fill the composer.
            </p>

            <div className="space-y-2.5">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className="p-3 rounded-xl border border-border-subtle bg-white hover:border-primary hover:bg-primary/5 cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase text-primary tracking-wider">
                      {tpl.category}
                    </span>
                    <span className="text-[10px] text-text-secondary group-hover:text-primary transition-colors font-bold">
                      Apply →
                    </span>
                  </div>
                  <h4 className="font-heading font-bold text-xs text-text-primary mb-1">
                    {tpl.title}
                  </h4>
                  <p className="text-[11px] text-text-secondary line-clamp-2">
                    {tpl.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Campaign History & Queue Progress */}
      <div className="card p-6 border border-border-subtle space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-base text-text-primary flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Recent Campaign Dispatches
          </h3>
          <button
            type="button"
            onClick={loadCampaignsAndStatus}
            className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh History
          </button>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-xs text-text-secondary py-4 text-center">No campaigns sent yet.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {campaigns.map((camp) => (
              <div key={camp.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-text-primary">{camp.title}</h4>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      camp.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : camp.status === 'sending'
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {camp.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary line-clamp-1 max-w-lg">
                    {camp.message}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    {new Date(camp.createdAt).toLocaleString()} · Audience: {camp.audience}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                  <div className="text-right">
                    <span className="text-emerald-700 font-bold">{camp.sentCount} sent</span>
                    {camp.failedCount > 0 && (
                      <span className="text-red-600 block text-[10px]">{camp.failedCount} failed</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

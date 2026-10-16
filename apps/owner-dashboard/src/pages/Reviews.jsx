// ── Reviews Page (Owner Dashboard) ──
// View all customer reviews with average rating and star breakdown.
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Star, MessageSquare, TrendingUp } from 'lucide-react';

export default function Reviews() {
  const { apiFetch, user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { loadReviews(); }, [page]);

  async function loadReviews() {
    setLoading(true);
    try {
      const data = await apiFetch(`/reviews?businessId=${user.businessId}&page=${page}&limit=20`);
      setReviews(data.reviews);
      setAvgRating(data.avgRating);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Load reviews error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Star distribution
  const starCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
  }));

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-heading font-bold text-text-primary mb-6">Reviews</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Average Rating */}
        <div className="card p-5 text-center">
          <div className="text-4xl font-bold text-text-primary mb-1">{avgRating || '—'}</div>
          <div className="flex items-center justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < Math.round(avgRating) ? 'text-secondary fill-secondary' : 'text-border-subtle'}`} />
            ))}
          </div>
          <p className="text-xs text-text-secondary">Average Rating</p>
        </div>

        {/* Total Reviews */}
        <div className="card p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-4xl font-bold text-text-primary mb-1">
            <MessageSquare className="w-6 h-6 text-primary" />
            {total}
          </div>
          <p className="text-xs text-text-secondary">Total Reviews</p>
        </div>

        {/* Star Distribution */}
        <div className="card p-5">
          <div className="space-y-1.5">
            {starCounts.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-right font-medium text-text-primary">{star}</span>
                <Star className="w-3.5 h-3.5 text-secondary fill-secondary" />
                <div className="flex-1 h-2 bg-bg-subtle rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all"
                    style={{ width: `${reviews.length > 0 ? (count / reviews.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-6 text-xs text-text-secondary">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="card p-4 h-24 animate-pulse" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="card p-8 text-center text-text-secondary">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No reviews yet. Reviews will appear here after customers leave feedback on their orders.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <div key={review.id} className="card p-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {review.customer?.user?.name?.charAt(0)?.toUpperCase() || 'C'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-text-primary">{review.customer?.user?.name || 'Customer'}</span>
                    <span className="text-xs text-text-secondary">
                      {new Date(review.order?.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-secondary fill-secondary' : 'text-border-subtle'}`} />
                    ))}
                  </div>

                  {/* Comment */}
                  {review.comment && (
                    <p className="text-sm text-text-primary mb-2">{review.comment}</p>
                  )}

                  {/* Order info */}
                  <div className="text-xs text-text-secondary">
                    Order #{review.order?.id?.slice(0, 8)} •
                    ₹{review.order?.total?.toFixed(0)} •
                    {review.order?.items?.map(i => i.menuItem?.name).join(', ')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-button text-sm bg-bg-subtle text-text-secondary disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-text-secondary">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-button text-sm bg-bg-subtle text-text-secondary disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

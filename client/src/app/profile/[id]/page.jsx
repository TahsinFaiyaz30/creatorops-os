'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { UserCircle, Briefcase, MapPin, Link as LinkIcon, Star, MessageSquare, ShieldCheck, ArrowLeft, StarHalf } from 'lucide-react';
import AppShell from '../../../components/layout/AppShell';
import { api } from '../../../lib/api';
import { getUser } from '../../../lib/auth';
import { getRoleLabels, isBrandRep } from '../../../lib/roles';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Review Form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewContext, setReviewContext] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  
  useEffect(() => {
    setCurrentUser(getUser());
    loadProfile();
  }, [params.id]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const payload = await api.get(`/api/users/profile/${params.id}`);
      setProfileData(payload.data || payload);
    } catch (err) {
      setMessage(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await api.post(`/api/users/${profileData.user._id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
        collaborationContext: reviewContext
      });
      setMessage('Review submitted successfully!');
      setShowReviewForm(false);
      setReviewComment('');
      setReviewContext('');
      loadProfile(); // Refresh to see new review
    } catch (err) {
      setMessage(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) {
        stars.push(<Star key={i} size={16} className="fill-gold text-gold" />);
      } else if (rating >= i - 0.5) {
        stars.push(<StarHalf key={i} size={16} className="fill-gold text-gold" />);
      } else {
        stars.push(<Star key={i} size={16} className="text-[var(--border)]" />);
      }
    }
    return <div className="flex gap-1">{stars}</div>;
  };

  if (loading) return <AppShell><div className="p-8 text-[var(--muted)] animate-pulse">Loading profile...</div></AppShell>;
  
  if (!profileData || !profileData.user) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-8">
          {message && (
            <div className="rounded-2xl border border-rose/30 bg-rose/10 p-4 text-sm font-medium text-rose shadow-sm">
              {message}
            </div>
          )}
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <UserCircle size={64} className="text-[var(--border)] mb-4" />
            <h2 className="text-2xl font-bold">User Not Found</h2>
            <p className="text-[var(--muted)] mt-2">The profile you are looking for does not exist or could not be loaded.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const { user, brandProfile, reviews } = profileData;
  const isOwnProfile = currentUser?.id === user._id || currentUser?._id === user._id || params.id === 'me';

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation & Header Actions */}
        <div className="flex justify-between items-center">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-mint transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
          {isOwnProfile && (
            <button onClick={() => router.push('/profile/edit')} className="px-4 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-xl text-sm font-bold hover:bg-mint hover:text-[#05130d] hover:border-mint transition-colors">
              Edit My Profile
            </button>
          )}
        </div>

        {message && (
          <div className="rounded-2xl border border-mint/30 bg-mint/10 p-4 text-sm font-medium text-mint shadow-sm">
            {message}
          </div>
        )}

        {/* Hero Section */}
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden relative">
          <div className="h-32 bg-gradient-to-r from-[var(--surface2)] to-mint/20"></div>
          <div className="px-8 pb-8 relative">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-12 mb-6">
              <div className="w-24 h-24 rounded-2xl bg-[#05130d] border-4 border-[var(--surface)] overflow-hidden shadow-lg flex items-center justify-center shrink-0">
                {user.profile?.avatarUrl ? (
                  <img src={user.profile.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <UserCircle size={48} className="text-[var(--muted)]" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-extrabold text-[var(--text)]">{user.name}</h1>
                  {isBrandRep(user) && <ShieldCheck size={20} className="text-gold" title="Verified Brand Representative" />}
                </div>
                <div className="flex flex-wrap gap-4 text-sm font-medium text-[var(--muted)]">
                  <span className="uppercase tracking-wider text-xs border border-[var(--border)] px-2 py-0.5 rounded-md bg-[var(--surface2)]">
                    {getRoleLabels(user).join(' + ')}
                  </span>
                  {user.profile?.location && (
                    <span className="flex items-center gap-1"><MapPin size={14} /> {user.profile.location}</span>
                  )}
                  {user.profile?.socialLinks?.length > 0 && (
                    <span className="flex items-center gap-1"><LinkIcon size={14} /> {user.profile.socialLinks.length} Social Links</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 text-2xl font-black text-[var(--text)]">
                  {user.averageRating ? user.averageRating.toFixed(1) : 'New'} <Star className="fill-gold text-gold" size={24} />
                </div>
                <p className="text-xs text-[var(--muted)]">{user.totalReviews || 0} Collaborations</p>
              </div>
            </div>

            {user.profile?.bio && (
              <p className="text-[var(--text)] leading-relaxed max-w-3xl mb-6">
                {user.profile.bio}
              </p>
            )}

            {user.profile?.socialLinks?.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {user.profile.socialLinks.map((link, idx) => (
                  <a key={idx} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:text-mint hover:border-mint transition-colors">
                    <LinkIcon size={12} /> {link.replace(/^https?:\/\//, '')}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Brand Details (If Brand Rep) */}
        {isBrandRep(user) && brandProfile && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-[var(--text)]">
              <Briefcase className="text-gold" /> Brand Representation
            </h2>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center p-2 shrink-0 border border-[var(--border)]">
                {brandProfile.logoUrl ? (
                  <img src={brandProfile.logoUrl} alt={brandProfile.brandName} className="max-w-full max-h-full object-contain" />
                ) : (
                  <Briefcase size={24} className="text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-black text-[var(--text)] mb-1">{brandProfile.brandName}</h3>
                <div className="flex gap-3 text-xs font-semibold text-[var(--muted)] mb-3">
                  {brandProfile.industry && <span className="bg-[var(--surface2)] px-2 py-1 rounded">{brandProfile.industry}</span>}
                  {brandProfile.website && (
                    <a href={brandProfile.website} target="_blank" rel="noreferrer" className="text-mint hover:underline">
                      Visit Website
                    </a>
                  )}
                </div>
                <p className="text-sm text-[var(--text)] leading-relaxed">{brandProfile.description || 'No description provided.'}</p>
              </div>
            </div>
          </section>
        )}

        {/* Reviews Section */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--text)]">
              <MessageSquare className="text-mint" /> Collaboration History
            </h2>
            {!isOwnProfile && currentUser && !showReviewForm && (
              <button onClick={() => setShowReviewForm(true)} className="px-4 py-2 bg-mint text-[#05130d] rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(var(--color-mint-rgb),0.3)] hover:brightness-110 transition-all">
                Leave a Review
              </button>
            )}
          </div>

          {/* Leave Review Form */}
          {showReviewForm && (
            <form onSubmit={submitReview} className="mb-8 p-6 rounded-2xl border border-mint/30 bg-mint/5 space-y-4 animate-in fade-in">
              <h3 className="text-lg font-bold text-[var(--text)] mb-2">Rate your collaboration with {user.name}</h3>
              <div className="flex gap-6 flex-wrap">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Rating (1-5)</span>
                  <select value={reviewRating} onChange={e => setReviewRating(Number(e.target.value))} className="mt-1 block w-24 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold text-[var(--text)] focus:border-mint focus:outline-none">
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Average</option>
                    <option value="2">2 - Poor</option>
                    <option value="1">1 - Terrible</option>
                  </select>
                </label>
                <label className="block flex-1 min-w-[200px]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Collaboration Context (Optional)</span>
                  <input type="text" value={reviewContext} onChange={e => setReviewContext(e.target.value)} placeholder="e.g. Summer Campaign 2026" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-mint focus:outline-none" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Review Comment</span>
                <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} required rows={3} placeholder="Share your experience working with them..." className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-mint focus:outline-none" />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowReviewForm(false)} className="px-4 py-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--text)]">Cancel</button>
                <button type="submit" disabled={submittingReview} className="px-6 py-2 bg-mint text-[#05130d] rounded-xl text-sm font-bold disabled:opacity-50">
                  {submittingReview ? 'Submitting...' : 'Post Review'}
                </button>
              </div>
            </form>
          )}

          {/* Review List */}
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-sm text-[var(--muted)] py-4 text-center border border-dashed border-[var(--border)] rounded-2xl">
                No reviews yet.
              </p>
            ) : (
              reviews.map(review => (
                <article key={review._id} className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface2)]">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#05130d] overflow-hidden border border-[var(--border)]">
                        {review.reviewerId?.profile?.avatarUrl ? (
                          <img src={review.reviewerId.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle size={40} className="text-[var(--muted)] -ml-[1px] -mt-[1px]" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[var(--text)]">{review.reviewerId?.name || 'Unknown User'}</div>
                        <div className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-wider">{review.reviewerId?.role?.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {renderStars(review.rating)}
                      <span className="text-[10px] text-[var(--muted)] mt-1">{new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {review.collaborationContext && (
                    <div className="text-[10px] font-bold text-mint bg-mint/10 inline-block px-2 py-0.5 rounded-md mb-2 border border-mint/20">
                      Context: {review.collaborationContext}
                    </div>
                  )}
                  <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{review.comment}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

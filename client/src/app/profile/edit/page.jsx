'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, UserCircle, Briefcase, Camera, Link as LinkIcon, MapPin, Globe } from 'lucide-react';
import AppShell from '../../../components/layout/AppShell';
import { api } from '../../../lib/api';
import { getUser } from '../../../lib/auth';

export default function EditProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState(''); // Comma separated

  // Brand Form State
  const [brandName, setBrandName] = useState('');
  const [brandDescription, setBrandDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);

    const loadProfile = async () => {
      try {
        const payload = await api.get('/api/users/profile/me');
        const data = payload.data;
        
        setName(data.user.name || '');
        if (data.user.profile) {
          setBio(data.user.profile.bio || '');
          setLocation(data.user.profile.location || '');
          setAvatarUrl(data.user.profile.avatarUrl || '');
          setSocialLinks((data.user.profile.socialLinks || []).join(', '));
        }

        if (data.brandProfile) {
          setBrandName(data.brandProfile.brandName || '');
          setBrandDescription(data.brandProfile.description || '');
          setIndustry(data.brandProfile.industry || '');
          setWebsite(data.brandProfile.website || '');
          setLogoUrl(data.brandProfile.logoUrl || '');
        }
      } catch (err) {
        setMessage(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    
    try {
      const payload = {
        name,
        bio,
        location,
        avatarUrl,
        socialLinks: socialLinks.split(',').map(s => s.trim()).filter(Boolean),
        brandDetails: user?.role === 'brand_rep' ? {
          brandName,
          description: brandDescription,
          industry,
          website,
          logoUrl
        } : undefined
      };

      await api.put('/api/users/profile', payload);
      setMessage('Profile updated successfully!');
      
      // Update local storage user name if it changed
      const currentAuth = JSON.parse(localStorage.getItem('creatorops_auth') || '{}');
      if (currentAuth.user) {
        currentAuth.user.name = name;
        localStorage.setItem('creatorops_auth', JSON.stringify(currentAuth));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <AppShell><div className="p-8 text-[var(--muted)]">Loading profile...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-mint/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="relative z-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-mint mb-2">Settings</p>
            <h1 className="text-4xl font-extrabold text-[var(--text)] tracking-tight">Edit Profile</h1>
            <p className="mt-3 text-sm text-[var(--muted)] max-w-2xl">
              Customize how you appear to other creators and brands on the platform.
            </p>
          </div>
        </header>

        {message && (
          <div className="rounded-2xl border border-mint/30 bg-mint/10 p-4 text-sm font-medium text-mint shadow-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-[var(--text)]">
              <UserCircle className="text-mint" /> Personal Details
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Full Name</span>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-mint focus:outline-none focus:ring-1 focus:ring-mint" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Location</span>
                  <div className="relative mt-1">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] pl-10 pr-4 py-2.5 text-sm text-[var(--text)] focus:border-mint focus:outline-none focus:ring-1 focus:ring-mint" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Social Links (comma separated)</span>
                  <div className="relative mt-1">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                    <input type="text" value={socialLinks} onChange={e => setSocialLinks(e.target.value)} placeholder="twitter.com/user, youtube.com/@user" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] pl-10 pr-4 py-2.5 text-sm text-[var(--text)] focus:border-mint focus:outline-none focus:ring-1 focus:ring-mint" />
                  </div>
                </label>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Avatar Image URL</span>
                  <div className="relative mt-1">
                    <Camera className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                    <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] pl-10 pr-4 py-2.5 text-sm text-[var(--text)] focus:border-mint focus:outline-none focus:ring-1 focus:ring-mint" />
                  </div>
                </label>
                <label className="block h-full">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Bio</span>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} placeholder="Tell people about yourself..." className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-mint focus:outline-none focus:ring-1 focus:ring-mint" />
                </label>
              </div>
            </div>
          </section>

          {user?.role === 'brand_rep' && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-[var(--text)]">
                <Briefcase className="text-gold" /> Brand Details
              </h2>
              <p className="text-xs text-[var(--muted)] mb-6">These details represent the brand across your workspace.</p>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Brand Name</span>
                    <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} required className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Industry</span>
                    <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Technology, Fashion, Gaming" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Website URL</span>
                    <div className="relative mt-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                      <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://brand.com" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] pl-10 pr-4 py-2.5 text-sm text-[var(--text)] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                    </div>
                  </label>
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Brand Logo URL</span>
                    <div className="relative mt-1">
                      <Camera className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                      <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] pl-10 pr-4 py-2.5 text-sm text-[var(--text)] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                    </div>
                  </label>
                  <label className="block h-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Brand Description</span>
                    <textarea value={brandDescription} onChange={e => setBrandDescription(e.target.value)} rows={4} placeholder="What does this brand do?" className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2.5 text-sm text-[var(--text)] focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold" />
                  </label>
                </div>
              </div>
            </section>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-xl border border-[var(--border)] bg-transparent text-sm font-bold hover:bg-[var(--surface2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-mint text-[#05130d] text-sm font-bold shadow-[0_0_15px_rgba(var(--color-mint-rgb),0.3)] hover:brightness-110 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {busy ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

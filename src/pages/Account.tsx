import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { AvatarUploader } from '../components/account/AvatarUploader';

interface DbUser {
  id: string;
  email?: string | null;
  subscription_plan?: string | null;
  credits_balance?: number | null;
}

export default function Account() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [agencyWebsite, setAgencyWebsite] = useState('');
  const [wantsTips, setWantsTips] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setError('Not signed in.');
        return;
      }
      setUsername((authData?.user?.user_metadata?.username as string) || '');
      setAvatarUrl((authData?.user?.user_metadata?.avatar_url as string) || null);
      setAgencyName((authData?.user?.user_metadata?.agency_name as string) || '');
      setAgencyWebsite((authData?.user?.user_metadata?.agency_site as string) || '');
      setWantsTips(
        typeof authData?.user?.user_metadata?.wants_tips === 'boolean'
          ? (authData?.user?.user_metadata?.wants_tips as boolean)
          : true
      );

      const { data, error: uErr } = await supabase
        .from('users')
        .select('id, email, subscription_plan, credits_balance')
        .eq('id', userId)
        .single();
      if (uErr) throw uErr;
      setDbUser(data as DbUser);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load account');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Not signed in');

      const { error: upErr } = await supabase.auth.updateUser({
        data: {
          username,
          avatar_url: avatarUrl || null,
          agency_name: agencyName || '',
          agency_site: agencyWebsite || '',
          wants_tips: !!wantsTips,
        },
      });
      if (upErr) throw upErr;
      setSuccess('Profile updated.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Account</h1>

        <div className="bg-zinc-900 border border-white/10 rounded-lg p-5 space-y-6">
          {loading ? (
            <div className="text-zinc-400">Loading account…</div>
          ) : error ? (
            <div className="text-red-400 text-sm">{error}</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-zinc-400">Email</div>
                  <div className="text-white font-medium">{dbUser?.email || '—'}</div>
                </div>
                <a
                  href="/billing"
                  className="px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-sm"
                >
                  Billing & Credits
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-zinc-400">Plan</div>
                    <div className="text-white font-semibold">
                      {dbUser?.subscription_plan ?? 'free'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-zinc-400">Credits</div>
                    <div className="text-white text-xl font-bold">
                      {dbUser?.credits_balance ?? 0}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-zinc-400 mb-2">Avatar</div>
                    <AvatarUploader
                      value={avatarUrl}
                      onChange={(url) => setAvatarUrl(url)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-zinc-400">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your-username"
                  className="w-full px-3 py-2 rounded bg-zinc-800 border border-white/10 text-zinc-200 focus:outline-none focus:border-violet-500"
                />
                <p className="text-xs text-zinc-500">
                  This is stored in your auth profile and used across the app.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Agency / Brand</label>
                  <input
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Lenci Studio"
                    className="w-full px-3 py-2 rounded bg-zinc-800 border border-white/10 text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Website</label>
                  <input
                    value={agencyWebsite}
                    onChange={(e) => setAgencyWebsite(e.target.value)}
                    placeholder="https://lenci.studio"
                    className="w-full px-3 py-2 rounded bg-zinc-800 border border-white/10 text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="wantsTips"
                  type="checkbox"
                  checked={wantsTips}
                  onChange={(e) => setWantsTips(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800"
                />
                <label htmlFor="wantsTips" className="text-sm text-zinc-300">
                  Email me weekly tips and inspiration (no spam, just vibes)
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="px-4 py-2 rounded bg-violet-600 hover:bg-violet-500 text-white text-sm disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {success && <span className="text-green-400 text-sm">{success}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



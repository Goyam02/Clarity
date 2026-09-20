import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Plus, X, Download, Trash2, AlertTriangle, CheckCircle2, User,
} from 'lucide-react';
import {
  usersApi, UserSettings, CompanyRef,
} from '../lib/api/endpoints';
import { ApiError, clearSession } from '../lib/api/client';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Settings (spec §9): intentionally thin. Every field either feeds an agent
 * (handles, target companies, default mood) or protects the account.
 */
export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [companies, setCompanies] = useState<CompanyRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [newCompany, setNewCompany] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [focusDraft, setFocusDraft] = useState('');
  const [cfDraft, setCfDraft] = useState('');
  const [ghDraft, setGhDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await usersApi.me();
      setSettings(s);
      setNameDraft(s.name || '');
      setFocusDraft(s.current_focus || '');
      setCfDraft(s.codeforces_handle || '');
      setGhDraft(s.github_username || '');
      const c = await usersApi.companies();
      setCompanies(c.companies);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patch = async (p: Partial<UserSettings>) => {
    setSaving(true);
    setError(null);
    try {
      const s = await usersApi.updateSettings(p);
      setSettings(s);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const addCompany = async () => {
    const name = newCompany.trim();
    if (!name) return;
    try {
      await usersApi.addCompany(name);
      setNewCompany('');
      const c = await usersApi.companies();
      setCompanies(c.companies);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add company.');
    }
  };

  const removeCompany = async (name: string) => {
    try {
      await usersApi.removeCompany(name);
      const c = await usersApi.companies();
      setCompanies(c.companies);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove company.');
    }
  };

  const exportData = async () => {
    try {
      const data = await usersApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clarity-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export failed.');
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Delete your account and all mastery data? This cannot be undone.')) return;
    try {
      await usersApi.deleteAccount();
      clearSession();
      setUser(null);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Account deletion failed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex items-center justify-center gap-3 font-mono text-[13px]">
        <RefreshCw className="w-4 h-4 animate-spin text-[#C1592B]" />
        <span className="text-[#1F2420]/60">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-[#1F2420]/8 bg-[#FAF6F0]/80 backdrop-blur-md">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[#1F2420]/70 hover:text-[#1F2420]">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        {savedFlash && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-mono text-[#3F8F63]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1
          className="text-[28px] font-normal tracking-[-0.02em]"
          style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
        >
          Settings
        </h1>

        {error && (
          <div className="p-3 rounded-[8px] bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-[12.5px] text-red-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            {error}
          </div>
        )}

        {/* Profile */}
        <section className="p-5 sm:p-6 rounded-[14px] bg-[#FBF9F5] border border-[#1F2420]/10 space-y-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <User className="w-4 h-4 text-[#C1592B]" /> Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="set-name" className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">Name</label>
              <div className="flex gap-2">
                <input
                  id="set-name"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="flex-1 px-3 py-2 text-[14px] bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
                />
                <button
                  type="button"
                  disabled={saving || nameDraft === (settings?.name ?? '')}
                  onClick={() => void patch({ name: nameDraft })}
                  className="px-3 py-2 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[12.5px] font-medium disabled:opacity-40 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">Email</label>
              <input
                value={settings?.email || ''}
                readOnly
                className="w-full px-3 py-2 text-[14px] bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[6px] text-[#1F2420]/60 cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label htmlFor="set-focus" className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">Currently studying</label>
            <div className="flex gap-2">
              <input
                id="set-focus"
                value={focusDraft}
                onChange={(e) => setFocusDraft(e.target.value)}
                placeholder="Graphs, DBMS indexing..."
                className="flex-1 px-3 py-2 text-[14px] bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
              />
              <button
                type="button"
                disabled={saving || focusDraft === (settings?.current_focus ?? '')}
                onClick={() => void patch({ current_focus: focusDraft })}
                className="px-3 py-2 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[12.5px] font-medium disabled:opacity-40 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </section>

        {/* Connected accounts */}
        <section className="p-5 sm:p-6 rounded-[14px] bg-[#FBF9F5] border border-[#1F2420]/10 space-y-4">
          <h2 className="text-[15px] font-semibold">Connected accounts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="set-cf" className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">Codeforces handle</label>
              <div className="flex gap-2">
                <input
                  id="set-cf"
                  value={cfDraft}
                  onChange={(e) => setCfDraft(e.target.value)}
                  placeholder="tourist"
                  className="flex-1 px-3 py-2 text-[14px] bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
                />
                <button
                  type="button"
                  disabled={saving || cfDraft === (settings?.codeforces_handle ?? '')}
                  onClick={() => void patch({ codeforces_handle: cfDraft })}
                  className="px-3 py-2 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[12.5px] font-medium disabled:opacity-40 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="set-gh" className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">GitHub username</label>
              <div className="flex gap-2">
                <input
                  id="set-gh"
                  value={ghDraft}
                  onChange={(e) => setGhDraft(e.target.value)}
                  placeholder="octocat"
                  className="flex-1 px-3 py-2 text-[14px] bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
                />
                <button
                  type="button"
                  disabled={saving || ghDraft === (settings?.github_username ?? '')}
                  onClick={() => void patch({ github_username: ghDraft })}
                  className="px-3 py-2 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[12.5px] font-medium disabled:opacity-40 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11.5px] font-mono text-[#1F2420]/50">
            LeetCode / GFG: screenshot-based — re-upload anytime from onboarding.
          </p>
        </section>

        {/* Target companies */}
        <section className="p-5 sm:p-6 rounded-[14px] bg-[#FBF9F5] border border-[#1F2420]/10 space-y-3">
          <h2 className="text-[15px] font-semibold">Target companies</h2>
          <div className="flex flex-wrap gap-2">
            {companies.length === 0 && (
              <span className="text-[13px] text-[#1F2420]/50">None yet — add up to 5.</span>
            )}
            {companies.map((c) => (
              <span
                key={c.name}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-[6px] bg-white border border-[#1F2420]/15 text-[13px]"
                title={c.in_corpus ? `Corpus patterns: ${c.top_patterns.join(', ') || '—'}` : 'Not in corpus yet'}
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => void removeCompany(c.name)}
                  aria-label={`Remove ${c.name}`}
                  className="p-0.5 rounded hover:bg-[#B8322A]/10 text-[#1F2420]/50 hover:text-[#B8322A] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void addCompany(); }}
              placeholder="ServiceNow"
              className="flex-1 px-3 py-2 text-[14px] bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
            />
            <button
              type="button"
              onClick={() => void addCompany()}
              disabled={!newCompany.trim() || companies.length >= 5}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[12.5px] font-medium disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </section>

        {/* Default mood */}
        <section className="p-5 sm:p-6 rounded-[14px] bg-[#FBF9F5] border border-[#1F2420]/10">
          <h2 className="text-[15px] font-semibold mb-3">Default mood</h2>
          <div className="flex items-center gap-2">
            {(['light', 'normal', 'push'] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={saving}
                onClick={() => void patch({ default_mood: m })}
                className={`px-4 py-2 rounded-[6px] text-[13.5px] font-medium border capitalize transition-all cursor-pointer disabled:opacity-50 ${
                  settings?.default_mood === m
                    ? 'bg-[#1F2420] border-[#1F2420] text-[#FAF6F0]'
                    : 'bg-transparent border-[#1F2420]/20 text-[#1F2420]/70 hover:border-[#1F2420]/45'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </section>

        {/* Data */}
        <section className="p-5 sm:p-6 rounded-[14px] bg-[#FBF9F5] border border-[#1F2420]/10 space-y-3">
          <h2 className="text-[15px] font-semibold">Data</h2>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => void exportData()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[6px] border border-[#1F2420]/25 text-[13px] font-medium hover:bg-[#1F2420]/5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export my data
            </button>
            <button
              type="button"
              onClick={() => void deleteAccount()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-[6px] border border-[#B8322A]/40 text-[#B8322A] text-[13px] font-medium hover:bg-[#B8322A]/5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, CheckCircle2, Compass, FileText, Github, Mic, Plus, RefreshCw, Save, Settings, Target, Upload, X } from 'lucide-react';
import { usersApi, uploadsApi, type ProfileOverview, type UserSettings } from '../lib/api/endpoints';
import { useAuth } from '../lib/auth/AuthContext';
import { UserMenu } from '../components/auth/UserMenu';

const inputClass = 'w-full mt-2 rounded-xl border border-[#1F2420]/15 bg-white px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C1592B]/35';
const panelClass = 'rounded-[22px] border border-[#1F2420]/10 bg-[#FFFDFA] p-6 sm:p-7';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [data, setData] = useState<ProfileOverview | null>(null);
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [skill, setSkill] = useState('');
  const [project, setProject] = useState('');
  const [company, setCompany] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await usersApi.overview(); setData(result); setDraft(result.profile); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load profile.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  function update(patch: Partial<UserSettings>) { setDraft(d => d ? { ...d, ...patch } : d); setNotice(''); }

  async function save() {
    if (!draft || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await usersApi.updateSettings({ name: draft.name.trim(), current_focus: draft.current_focus,
        placement_timeline: draft.placement_timeline, default_mood: draft.default_mood,
        skills: draft.skills, projects: draft.projects,
        github_username: draft.github_username?.trim() || '', codeforces_handle: draft.codeforces_handle?.trim() || '' });
      setDraft(saved); setData(d => d ? { ...d, profile: saved } : d);
      if (user) { const [firstName, ...rest] = saved.name.split(/\s+/); setUser({ ...user, firstName, lastName: rest.join(' ') }); }
      setNotice('Your profile is saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save profile.'); }
    finally { setBusy(false); }
  }
  async function resume(file?: File) {
    if (!file || uploading) return;
    if (file.size > 8 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf')) { setError('Choose a PDF smaller than 8 MB.'); return; }
    setUploading(true); setError(''); setNotice('');
    try {
      const extracted = await uploadsApi.resume(file);
      setDraft(d => d ? { ...d, resume_blob_ref: extracted.blob_ref,
        skills: [...new Set([...d.skills, ...extracted.skills])].slice(0, 40),
        projects: [...new Set([...d.projects, ...extracted.projects])].slice(0, 20) } : d);
      setNotice('Resume attached. Review the extracted skills and projects below, then save your profile.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read resume.'); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function changeCompany(name: string, remove = false) {
    if (!name.trim() || companyBusy) return;
    setCompanyBusy(true); setError('');
    try {
      const result = remove ? await usersApi.removeCompany(name) : await usersApi.addCompany(name.trim());
      setDraft(d => d ? { ...d, target_companies: result.companies } : d);
      setData(d => d ? { ...d, profile: { ...d.profile, target_companies: result.companies } } : d);
      setCompany(''); setNotice('Target companies updated.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update company.'); }
    finally { setCompanyBusy(false); }
  }
  function addItem(kind: 'skills' | 'projects', value: string) {
    if (!draft || !value.trim()) return;
    if (draft[kind].length >= (kind === 'skills' ? 40 : 20)) return;
    update({ [kind]: [...new Set([...draft[kind], value.trim()])] });
    if (kind === 'skills') setSkill(''); else setProject('');
  }

  return <div className="min-h-screen bg-[#F7F4EE] text-[#1F2420]">
    <header className="border-b border-[#1F2420]/10 bg-[#FFFDFA]"><div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between"><Link to="/dashboard" className="flex gap-2 items-center text-sm"><ArrowLeft size={17} /> Dashboard</Link><div className="flex items-center gap-4"><Link to="/settings" aria-label="Account settings"><Settings size={18} /></Link><UserMenu /></div></div></header>
    <main className="max-w-6xl mx-auto px-5 py-9 sm:py-12">
      {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 border border-red-200 text-red-800 p-4 text-sm">{error}{!data && <button onClick={() => void load()} className="ml-3 underline">Retry</button>}</div>}
      {loading && <div className="py-16 flex gap-3 items-center justify-center"><RefreshCw className="animate-spin" size={20} /> Loading your profile…</div>}
      {data && draft && !loading && <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-9">
          <div className="flex items-center gap-5"><div className="rounded-[24px] bg-[#263A32] text-[#DBBE86] w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center text-3xl font-serif shrink-0">{data.profile.name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'C'}</div>
            <div><span className="text-[10px] uppercase tracking-[.2em] text-[#C1592B] font-bold">Your preparation, in focus</span><h1 className="font-serif text-3xl sm:text-4xl mt-2">{data.profile.name || 'Your profile'}</h1><p className="text-sm text-[#1F2420]/55 mt-1">{data.profile.email}</p></div></div>
          <Link to="/interview" className="inline-flex self-start sm:self-auto gap-2 items-center rounded-xl bg-[#1F2420] text-white px-5 py-3 text-sm font-semibold"><Mic size={16} /> Practice an interview</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">{[
          ['Topics tracked', data.stats.topics], ['Practice updates', data.stats.practice_updates],
          ['Interviews completed', data.stats.interviews], ['Assessments completed', data.stats.assessments],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#1F2420]/10 bg-[#FFFDFA] px-5 py-4"><div className="font-serif text-3xl">{value}</div><div className="text-xs text-[#1F2420]/55 mt-1">{label}</div></div>)}</div>
        {notice && <div role="status" className="mb-6 p-4 rounded-xl bg-[#5B6B4D]/10 text-[#415333] text-sm flex items-start gap-2"><CheckCircle2 size={17} className="shrink-0 mt-0.5" />{notice}</div>}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] gap-6 items-start">
          <div className="space-y-6">
            <form onSubmit={e => { e.preventDefault(); void save(); }} className={panelClass}>
              <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-2xl">Make it yours</h2><span className="text-[10px] text-[#1F2420]/40 uppercase tracking-wider">Profile details</span></div>
              <fieldset disabled={busy || uploading} className="mt-6 space-y-5 disabled:opacity-65">
                <div className="grid sm:grid-cols-2 gap-4"><label className="text-xs font-medium">Full name<input required maxLength={255} value={draft.name} onChange={e => update({ name: e.target.value })} className={inputClass} autoComplete="name" /></label>
                  <label className="text-xs font-medium">Target date or timeline<input value={draft.placement_timeline || ''} onChange={e => update({ placement_timeline: e.target.value })} placeholder="2026-11-15 or next month" maxLength={255} className={inputClass} /></label></div>
                <label className="block text-xs font-medium">What are you focusing on?<textarea rows={2} value={draft.current_focus || ''} onChange={e => update({ current_focus: e.target.value })} placeholder="Graph algorithms, backend interviews, explaining trade-offs…" className={inputClass} /></label>
                <div className="grid sm:grid-cols-2 gap-4"><label className="text-xs font-medium">GitHub username<input value={draft.github_username || ''} onChange={e => update({ github_username: e.target.value })} maxLength={64} className={inputClass} placeholder="Your GitHub handle" /></label>
                  <label className="text-xs font-medium">Codeforces handle<input value={draft.codeforces_handle || ''} onChange={e => update({ codeforces_handle: e.target.value })} maxLength={64} className={inputClass} placeholder="Your Codeforces handle" /></label></div>
                <div className="border-t border-[#1F2420]/10 pt-5"><h3 className="text-sm font-semibold">Skills</h3><p className="text-xs text-[#1F2420]/50 mt-1">Languages, frameworks, and technical strengths. Up to 40.</p><div className="flex flex-wrap gap-2 mt-3">{draft.skills.map(s => <span key={s} className="inline-flex gap-2 items-center bg-[#ECEEE7] text-[#415333] pl-3 pr-2 py-1.5 rounded-lg text-xs">{s}<button type="button" aria-label={`Remove skill ${s}`} onClick={() => update({ skills: draft.skills.filter(v => v !== s) })}><X size={13} /></button></span>)}</div>
                  <div className="flex gap-2 mt-3"><input aria-label="Add a skill" maxLength={200} value={skill} onChange={e => setSkill(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('skills', skill); } }} placeholder="e.g. Python" className={`${inputClass} !mt-0`} /><button type="button" aria-label="Add skill" disabled={!skill.trim() || draft.skills.length >= 40} onClick={() => addItem('skills', skill)} className="rounded-xl border px-3 disabled:opacity-40"><Plus size={18} /></button></div>
                </div>
                <div className="border-t border-[#1F2420]/10 pt-5"><h3 className="text-sm font-semibold">Projects you can talk about</h3><div className="space-y-2 mt-3">{draft.projects.map(p => <div key={p} className="flex items-center gap-3 text-sm rounded-xl bg-[#F7F4EE] px-3 py-3"><BriefcaseBusiness size={16} className="text-[#C1592B] shrink-0" /><span className="flex-1 break-words">{p}</span><button type="button" aria-label={`Remove project ${p}`} onClick={() => update({ projects: draft.projects.filter(v => v !== p) })}><X size={14} /></button></div>)}</div>
                  <div className="flex gap-2 mt-3"><input aria-label="Add a project" maxLength={200} value={project} onChange={e => setProject(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem('projects', project); } }} placeholder="Project title and a short description" className={`${inputClass} !mt-0`} /><button type="button" aria-label="Add project" disabled={!project.trim() || draft.projects.length >= 20} onClick={() => addItem('projects', project)} className="rounded-xl border px-3 disabled:opacity-40"><Plus size={18} /></button></div>
                </div>
                <label className="block text-xs font-medium">Default study pace<select className={inputClass} value={draft.default_mood} onChange={e => update({ default_mood: e.target.value })}><option value="light">Light · a gentler session</option><option value="normal">Normal · steady progress</option><option value="push">Push · stretch yourself</option></select></label>
                <div className="flex flex-wrap gap-3 items-center pt-2"><button type="submit" disabled={!draft.name.trim()} className="rounded-xl px-5 py-3 bg-[#C1592B] text-white text-sm font-semibold inline-flex gap-2 items-center disabled:opacity-50"><Save size={16} />{busy ? 'Saving…' : 'Save profile'}</button>
                  <button type="button" onClick={() => { setDraft(data.profile); setNotice(''); }} className="text-sm text-[#1F2420]/60 px-3 py-2">Reset unsaved changes</button></div>
              </fieldset>
            </form>
            <section className={panelClass}><div className="flex items-center justify-between"><h2 className="font-serif text-2xl">Recent interview reviews</h2><Mic size={20} className="text-[#C1592B]" /></div>
              {data.recent_interviews.length ? <div className="mt-4 divide-y divide-[#1F2420]/8">{data.recent_interviews.map(r => <Link key={r.session_id} to={`/interview/${r.session_id}/debrief`} className="block py-4 group"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold group-hover:text-[#C1592B] capitalize">{r.company ? `${r.company} · ` : ''}{r.topic.replaceAll('-', ' ') || 'Practice interview'}</span><ArrowUpRight size={16} /></div><p className="mt-2 text-xs text-[#1F2420]/50">{new Date(r.completed_at).toLocaleDateString()} · {r.correctness == null ? 'No score' : `${Math.round(r.correctness * 100)}% approach quality`}</p><p className="text-sm mt-2 text-[#1F2420]/60 line-clamp-2">{r.feedback}</p></Link>)}</div>
                : <div className="mt-5 rounded-xl bg-[#F7F4EE] p-5"><p className="text-sm text-[#1F2420]/60">Your reviews will appear here after your first interview.</p><Link to="/interview" className="text-sm text-[#C1592B] font-semibold inline-block mt-3">Start a short practice →</Link></div>}
            </section>
          </div>
          <aside className="space-y-5">
            <section className="rounded-[22px] bg-[#263A32] text-[#FAF6F0] p-6"><Target size={23} className="text-[#DBBE86]" /><h2 className="font-serif text-2xl mt-4">Your next chapter</h2><p className="text-xs text-white/55 mt-2">Target companies shape your practice queue.</p>
              <div className="flex flex-wrap gap-2 mt-4">{draft.target_companies.map(c => <span key={c} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs">{c}<button disabled={companyBusy} onClick={() => void changeCompany(c, true)} aria-label={`Remove ${c}`}><X size={12} /></button></span>)}</div>
              <form onSubmit={e => { e.preventDefault(); void changeCompany(company); }} className="flex gap-2 mt-4"><input aria-label="Target company" value={company} onChange={e => setCompany(e.target.value)} maxLength={100} placeholder="Add a company" className="min-w-0 flex-1 border border-white/20 bg-white/5 rounded-xl p-3 text-xs placeholder:text-white/40" /><button aria-label="Add target company" disabled={companyBusy || !company.trim() || draft.target_companies.length >= 5} className="border border-white/20 px-3 rounded-xl disabled:opacity-30"><Plus size={16} /></button></form><p className="text-[10px] text-white/40 mt-3">Up to 5 companies · saved immediately</p>
            </section>
            <section className={panelClass}><FileText size={22} className="text-[#C1592B]" /><h2 className="font-semibold mt-4">Your resume</h2><p className="text-xs leading-6 text-[#1F2420]/55 mt-2">{draft.resume_blob_ref ? 'A resume is attached. Upload a newer version to refresh your skills and projects.' : 'Import skills and projects from a text-based PDF, then review them before saving.'}</p><input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Upload resume PDF" onChange={e => void resume(e.target.files?.[0])} /><button disabled={uploading || busy} onClick={() => fileInput.current?.click()} className="mt-4 w-full border rounded-xl py-3 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50">{uploading ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}{uploading ? 'Reading your resume…' : 'Upload PDF · max 8 MB'}</button></section>
            <section className={panelClass}><h2 className="font-semibold text-sm">Connected profiles</h2><div className="space-y-3 mt-4 text-sm">
              {data.profile.github_username && <a href={`https://github.com/${encodeURIComponent(data.profile.github_username)}`} target="_blank" rel="noopener noreferrer" className="flex gap-2 items-center hover:text-[#C1592B]"><Github size={16} /> GitHub <ArrowUpRight size={14} className="ml-auto" /></a>}
              {data.profile.codeforces_handle && <a href={`https://codeforces.com/profile/${encodeURIComponent(data.profile.codeforces_handle)}`} target="_blank" rel="noopener noreferrer" className="flex items-center">Codeforces <ArrowUpRight size={14} className="ml-auto" /></a>}
              <p className="text-xs text-[#1F2420]/60">LeetCode: {data.profile.leetcode?.username || 'Not connected'}{data.profile.leetcode?.expired ? ' · reconnect needed' : ''}</p><Link to="/settings" className="inline-flex text-xs text-[#C1592B] font-semibold">Manage connections →</Link></div></section>
            <section className={panelClass}><Compass size={21} className="text-[#5B6B4D]" /><h2 className="font-semibold text-sm mt-3">Your strongest topics</h2><div className="space-y-4 mt-4">{data.strengths.map(s => <Link key={s.id} to={`/dashboard/revision/${encodeURIComponent(s.id)}`} className="block"><div className="flex justify-between gap-2 text-xs"><span>{s.name}</span><span className="text-[#5B6B4D]">{Math.round(s.effective_mastery * 100)}%</span></div><div className="mt-2 h-1.5 bg-[#1F2420]/5 rounded-full"><div className="h-full rounded-full bg-[#5B6B4D]" style={{ width: `${Math.round(s.effective_mastery * 100)}%` }} /></div></Link>)}</div><Link to="/dashboard/graph" className="inline-block mt-5 text-xs text-[#C1592B] font-semibold">Explore knowledge graph →</Link></section>
          </aside>
        </div>
      </>}
    </main>
  </div>;
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, Clock, Mic, RefreshCw } from 'lucide-react';
import { dailyApi, type RevisionSet } from '../lib/api/endpoints';
import { UserMenu } from '../components/auth/UserMenu';

export function RevisionPage() {
  const { topicId = '' } = useParams();
  const [data, setData] = useState<RevisionSet | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState('');
  const [minutes, setMinutes] = useState(20);
  const [outcome, setOutcome] = useState('1');
  const [saving, setSaving] = useState(false);
  const [logged, setLogged] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setData(null); setError(''); setSelected(''); setLogged([]);
    dailyApi.revision(topicId).then(d => { if (active) setData(d); })
      .catch(e => { if (active) setError(e.message || 'Could not load practice questions.'); });
    return () => { active = false; };
  }, [topicId, retry]);

  async function logPractice() {
    const problem = data?.problems.find(p => p.url === selected);
    if (!problem || saving || logged.includes(selected)) return;
    setSaving(true); setError('');
    try {
      await dailyApi.logManual(topicId, problem.title, problem.url, 'Self-reported LeetCode revision', Number(outcome), minutes);
      setLogged(prev => [...prev, problem.url]); setSelected('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save practice.'); }
    finally { setSaving(false); }
  }

  return <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420]">
    <header className="border-b border-[#1F2420]/10"><div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} /> Dashboard</Link><UserMenu />
    </div></header>
    <main className="max-w-5xl mx-auto px-5 py-10 sm:py-14">
      <span className="text-xs uppercase tracking-[.2em] text-[#C1592B] font-semibold">Your next deliberate practice</span>
      <h1 className="mt-3 text-4xl sm:text-5xl font-serif">{data?.title || 'Revision practice'}</h1>
      <p className="mt-4 max-w-xl text-[#1F2420]/65">Pick a question, solve it on LeetCode, then return to record how it went. Every question opens in a new tab.</p>
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}
        {!data && <button onClick={() => setRetry(n => n + 1)} className="ml-3 underline">Retry</button>}</div>}
      {!data && !error && <div className="py-16 flex items-center gap-3"><RefreshCw className="animate-spin" size={20} /> Finding practice questions…</div>}
      {data && <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-3" aria-label="LeetCode practice questions">
          {data.problems.length === 0 && <div className="rounded-2xl border p-6">No linked questions for this topic yet. Try an approach interview using the practice button.</div>}
          {data.problems.map((p, i) => <article key={p.url} className="rounded-2xl bg-[#FFFDFA] border border-[#1F2420]/10 p-5 shadow-sm">
            <div className="flex items-start gap-4"><span className="font-mono text-sm text-[#1F2420]/35 mt-1">{String(i + 1).padStart(2, '0')}</span>
              <div className="flex-1"><div className="flex flex-wrap gap-2 text-[11px] mb-2"><span className="rounded bg-[#5B6B4D]/10 text-[#5B6B4D] px-2 py-1">{p.difficulty}</span>
                <span className="px-2 py-1 text-[#1F2420]/50">{p.source === 'company_corpus' ? `${data.company} corpus` : 'Curated practice'}</span></div>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-3 font-semibold text-lg hover:text-[#C1592B]">
                  {p.title}<ArrowUpRight size={20} className="shrink-0 mt-1" />
                </a>
                <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#C1592B] hover:underline">Solve on LeetCode ↗</a>
                  <button disabled={logged.includes(p.url) || saving} onClick={() => setSelected(selected === p.url ? '' : p.url)} className="text-xs font-medium flex items-center gap-1.5 disabled:text-[#5B6B4D]">
                    <CheckCircle2 size={15} />{logged.includes(p.url) ? 'Practice recorded' : 'Log my attempt'}</button>
                </div>
                {selected === p.url && <form onSubmit={e => { e.preventDefault(); void logPractice(); }} className="mt-4 pt-4 border-t space-y-3">
                  <p className="text-xs text-[#1F2420]/60">Self-reported practice updates your mastery. Opening a link does not mark it solved.</p>
                  <div className="flex flex-wrap gap-3"><label className="text-xs">Result<select value={outcome} onChange={e => setOutcome(e.target.value)} className="block border rounded-lg p-2 mt-1 bg-white"><option value="1">Solved independently</option><option value="0.5">Solved with help</option><option value="0">Still working on it</option></select></label>
                    <label className="text-xs">Minutes<input type="number" min={1} max={480} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="block w-24 border rounded-lg p-2 mt-1" /></label></div>
                  <button disabled={saving || minutes < 1 || minutes > 480} className="rounded-lg bg-[#1F2420] text-white px-4 py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save practice'}</button>
                </form>}
              </div>
            </div>
          </article>)}
        </section>
        <aside className="space-y-4">
          <div className="p-6 bg-[#ECEEE7] rounded-2xl"><BookOpen className="text-[#5B6B4D]" size={22} /><h2 className="mt-4 font-semibold">Before you solve</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#1F2420]/70">{data.concept || 'Explain the brute-force approach first. Identify the invariant, choose your data structure, then check complexity and edge cases.'}</p>
            <div className="mt-4 text-xs flex gap-2 items-center"><Clock size={14} /> Aim for one focused 20-minute attempt.</div></div>
          <Link to={`/interview?topic=${encodeURIComponent(topicId)}`} className="block p-6 rounded-2xl border border-[#C1592B]/25 bg-[#C1592B]/5 hover:bg-[#C1592B]/10"><Mic size={22} className="text-[#C1592B]" /><h2 className="mt-3 font-semibold">Talk through your approach</h2><p className="text-sm mt-2 text-[#1F2420]/60">Practice this topic with a spoken AI interview.</p></Link>
        </aside>
      </div>}
    </main>
  </div>;
}

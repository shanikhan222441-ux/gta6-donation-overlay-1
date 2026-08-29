import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './styles.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const money = (value, currency = 'Rs.') => `${currency} ${Math.round(Number(value || 0)).toLocaleString('en-US')}`;

// Timing for the donation sequence: slide in -> hold -> slide out -> count up.
const HOLD_MS = 3200;
const COUNT_MS = 1300;

function ConfigMissing() {
  return <div className="config-screen"><div className="config-card"><div className="logo">V-DONATE</div><h1>Supabase config missing</h1><p>Add <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> in Vercel Environment Variables, then redeploy.</p></div></div>;
}

// Eases a number from `from` to `to` over `duration` ms, calling onUpdate every
// animation frame and onDone once it settles exactly on `to`.
function animateNumber(from, to, duration, onUpdate, onDone) {
  const start = performance.now();
  const delta = to - from;
  let raf;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    onUpdate(from + delta * eased);
    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone && onDone();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

function Overlay() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayTotal, setDisplayTotal] = useState(0);
  const [flash, setFlash] = useState(null);
  // phase: 'idle' -> 'enter' -> 'hold' -> 'exit' -> 'counting' -> 'idle'
  const [phase, setPhase] = useState('idle');
  const holdTimerRef = useRef(null);
  const cancelCountRef = useRef(null);

  const load = async () => {
    const { data, error } = await supabase.from('donation_settings').select('*').eq('id', 1).single();
    if (!error) { setSettings(data); setDisplayTotal(Number(data.total_amount || 0)); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('donation-settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'donation_settings', filter: 'id=eq.1' }, (payload) => {
        const next = payload.new;
        const isDonationEvent = Number(next.current_amount) > 0 && !!next.current_name;
        setSettings(next);
        if (isDonationEvent) {
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          if (cancelCountRef.current) cancelCountRef.current();
          setFlash({ name: next.current_name, amount: Number(next.current_amount), id: next.last_donation_id, newTotal: Number(next.total_amount) });
          setPhase('enter');
        } else {
          // Admin correction (set total / reset) — jump straight to the new value.
          setDisplayTotal(Number(next.total_amount || 0));
        }
      }).subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (cancelCountRef.current) cancelCountRef.current();
    };
  }, []);

  const handleEnterEnd = () => {
    if (phase !== 'enter') return;
    setPhase('hold');
    holdTimerRef.current = setTimeout(() => setPhase('exit'), HOLD_MS);
  };

  const handleExitEnd = () => {
    if (phase !== 'exit' || !flash) return;
    setPhase('counting');
    const from = displayTotal;
    const to = flash.newTotal;
    cancelCountRef.current = animateNumber(from, to, COUNT_MS, (v) => setDisplayTotal(v), () => setPhase('idle'));
  };

  if (loading || !settings) return <div className="overlay-loading"><div className="loading-ring" /></div>;

  const target = Math.max(1, Number(settings.target_amount || 1));
  const progress = Math.min(100, Math.max(0, (displayTotal / target) * 100));
  const left = Math.max(0, target - displayTotal);
  const currency = settings.currency || 'Rs.';
  const showFlashCard = flash && (phase === 'enter' || phase === 'hold' || phase === 'exit');
  const isCounting = phase === 'counting';

  return <div className="overlay-page">
    <div className="corner-stage">
      <div className="corner-panel">
        <div className="corner-mark tl" /><div className="corner-mark tr" />
        <div className="corner-mark bl" /><div className="corner-mark br" />

        <div className="cp-viewport">
          {!showFlashCard && (
            <div className="cp-progress">
              <div className="cp-head">
                <span className="cp-title">{settings.title}</span>
                <span className="cp-percent">{progress.toFixed(0)}%</span>
              </div>
              <div className="cp-track">
                <div className={`cp-fill${isCounting ? ' is-live' : ''}`} style={{ width: `${progress}%` }}>
                  <div className="cp-gloss" />
                </div>
              </div>
              <div className="cp-stats">
                <span><b className={isCounting ? 'ticking' : ''}>{money(displayTotal, currency)}</b>raised</span>
                <span><b>{money(left, currency)}</b>left</span>
              </div>
            </div>
          )}

          {flash && (phase === 'enter' || phase === 'hold' || phase === 'exit') && (
            <div
              key={flash.id}
              className={`cp-donation ${phase === 'exit' ? 'slide-exit' : 'slide-enter'}`}
              onAnimationEnd={phase === 'exit' ? handleExitEnd : handleEnterEnd}
            >
              <div className="cp-live"><span className="live-dot" /> LIVE DONATION</div>
              <div className="cp-name">{flash.name}</div>
              <div className="cp-amount">+ {money(flash.amount, currency)}</div>
              <div className="cp-thanks">THANK YOU FOR THE SUPPORT<span>♥</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>;
}

function Admin() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState(null);
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [currency, setCurrency] = useState('Rs.');
  const [title, setTitle] = useState('DONATION GOAL');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const load = async () => {
    const s = await supabase.from('donation_settings').select('*').eq('id', 1).single();
    if (!s.error) { setSettings(s.data); setTarget(s.data.target_amount); setCurrency(s.data.currency); setTitle(s.data.title); }
    const h = await supabase.from('donations').select('*').order('created_at', { ascending: false }).limit(20);
    if (!h.error) setHistory(h.data);
  };
  useEffect(() => { if (session) load(); }, [session]);

  const login = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false); if (error) setMsg(error.message); else setMsg('Logged in');
  };

  const addDonation = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setMsg('Enter a valid donation amount.');
    setBusy(true); setMsg('');
    const nextTotal = Number(settings.total_amount) + n;
    const donationId = crypto.randomUUID();
    const { error: dErr } = await supabase.from('donations').insert({ id: donationId, donor_name: name.trim() || 'Anonymous', amount: n });
    if (dErr) { setBusy(false); return setMsg(dErr.message); }
    const { error: sErr } = await supabase.from('donation_settings').update({ total_amount: nextTotal, current_name: name.trim() || 'Anonymous', current_amount: n, last_donation_id: donationId }).eq('id', 1);
    if (sErr) { setBusy(false); return setMsg(sErr.message); }
    setAmount(''); setName(''); setBusy(false); setMsg(`Added ${money(n, settings.currency)}`); load();
  };

  const saveGoal = async () => {
    const n = Number(target); if (!Number.isFinite(n) || n <= 0) return setMsg('Enter a valid target.');
    setBusy(true);
    const { error } = await supabase.from('donation_settings').update({ target_amount: n, currency, title }).eq('id', 1);
    setBusy(false); setMsg(error ? error.message : 'Goal saved.'); load();
  };

  const setTotal = async () => {
    const n = Number(window.prompt('New total amount:', settings.total_amount));
    if (!Number.isFinite(n) || n < 0) return;
    setBusy(true);
    const { error } = await supabase.from('donation_settings').update({ total_amount: n, current_name: null, current_amount: 0, last_donation_id: crypto.randomUUID() }).eq('id', 1);
    setBusy(false); setMsg(error ? error.message : 'Total updated.'); load();
  };

  const resetTotal = async () => {
    if (!window.confirm('Reset total to 0?')) return;
    setBusy(true); const { error } = await supabase.from('donation_settings').update({ total_amount: 0, current_name: null, current_amount: 0, last_donation_id: crypto.randomUUID() }).eq('id', 1);
    setBusy(false); setMsg(error ? error.message : 'Total reset.'); load();
  };

  if (!session) return <div className="admin-page"><div className="login-card"><div className="logo">V-DONATE</div><h1>Admin Login</h1><form onSubmit={login}><input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required/><input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required/><button disabled={busy}>{busy ? 'Logging in...' : 'LOGIN'}</button></form>{msg && <div className="msg">{msg}</div>}</div></div>;

  return <div className="admin-page"><div className="admin-shell"><header><div><div className="logo">V-DONATE</div><h1>Donation Control</h1></div><button className="ghost" onClick={() => supabase.auth.signOut()}>LOG OUT</button></header>
    <div className="admin-grid">
      <section className="panel main-panel"><div className="panel-title">ADD DONATION</div><div className="row"><label>Amount<input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500"/></label><label>Donor Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Ali"/></label></div><button className="primary" onClick={addDonation} disabled={busy}>+ ADD DONATION</button></section>
      <section className="panel"><div className="panel-title">GOAL SETTINGS</div><label>Goal<input type="number" min="1" value={target} onChange={e => setTarget(e.target.value)}/></label><label>Currency<input value={currency} onChange={e => setCurrency(e.target.value)}/></label><label>Title<input value={title} onChange={e => setTitle(e.target.value)}/></label><button className="primary" onClick={saveGoal} disabled={busy}>SAVE GOAL</button></section>
      <section className="panel"><div className="panel-title">CURRENT</div>{settings && <><div className="big-number">{money(settings.total_amount, settings.currency)}</div><div className="sub">TARGET {money(settings.target_amount, settings.currency)}</div></>}<div className="row two"><button className="secondary" onClick={setTotal}>SET TOTAL</button><button className="danger" onClick={resetTotal}>RESET</button></div>{msg && <div className="msg">{msg}</div>}</section>
      <section className="panel history"><div className="panel-title">DONATION HISTORY</div><div className="history-list">{history.map(x => <div className="history-item" key={x.id}><span>{x.donor_name}</span><b>{money(x.amount, settings?.currency || currency)}</b></div>)}</div></section>
    </div>
  </div></div>;
}

function App() {
  if (!supabase) return <ConfigMissing />;
  const path = window.location.pathname.toLowerCase();
  return path.startsWith('/admin') ? <Admin /> : <Overlay />;
}

createRoot(document.getElementById('root')).render(<App />);

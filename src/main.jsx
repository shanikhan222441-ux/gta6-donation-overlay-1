import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const fmt = (n, currency = "Rs.") =>
  `${currency} ${Number(n || 0).toLocaleString("en-US")}`;

function Overlay() {
  const [settings, setSettings] = useState(null);
  const [queue, setQueue] = useState([]);
  const [displayTotal, setDisplayTotal] = useState(0);
  const [activeDonation, setActiveDonation] = useState(null);
  const [isAnimatingBar, setIsAnimatingBar] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("donation_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setSettings(data);
      setDisplayTotal(Number(data.total_amount || 0));
    }
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel("overlay-donations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "donation_settings", filter: "id=eq.1" },
        (payload) => {
          if (payload.new) {
            setSettings(payload.new);
            setDisplayTotal(Number(payload.new.total_amount || 0));
            setIsAnimatingBar(true);
            setTimeout(() => setIsAnimatingBar(false), 1300);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "donations" },
        (payload) => {
          const d = payload.new;
          setQueue((q) => [...q, { id: d.id || crypto.randomUUID(), name: d.donor_name || d.name || "Anonymous", amount: Number(d.amount || 0) }]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (activeDonation || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActiveDonation(next);

    const t = setTimeout(() => {
      setActiveDonation(null);
      setIsAnimatingBar(true);
      setTimeout(() => setIsAnimatingBar(false), 1300);
    }, 4200);

    return () => clearTimeout(t);
  }, [queue, activeDonation]);

  const goal = Math.max(Number(settings?.target_amount || 0), 1);
  const total = Number(displayTotal || 0);
  const pct = Math.min((total / goal) * 100, 100);

  return (
    <div className="overlay">
      <div className={`donation-card ${isAnimatingBar ? "bar-update" : ""}`}>
        <div className="scanline" />
        <div className="top-line">
          <span className="live-dot" />
          <span>{settings?.title || "DONATION FOR GTA 6"}</span>
          <span className="percent">{pct.toFixed(0)}%</span>
        </div>

        <div className="goal-label">GOAL {fmt(goal, settings?.currency || "Rs.")}</div>

        <div className="progress-shell">
          <div className="progress-fill" style={{ width: `${pct}%` }}>
            <div className="fill-shine" />
            <div className="fill-glow" />
          </div>
        </div>

        <div className="amount-row">
          <span>{fmt(total, settings?.currency || "Rs.")}</span>
          <span>{fmt(goal, settings?.currency || "Rs.")}</span>
        </div>

        <div className={`donation-stage ${activeDonation ? "show" : ""}`}>
          {activeDonation ? (
            <>
              <div className="donation-caption">NEW DONATION</div>
              <div className="donor-name">{activeDonation.name}</div>
              <div className="donor-amount">+ {fmt(activeDonation.amount, settings?.currency || "Rs.")}</div>
              <div className="thankyou">THANK YOU FOR THE SUPPORT ♥</div>
            </>
          ) : (
            <div className="waiting">WAITING FOR THE NEXT DONATION ♥</div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return window.location.pathname === "/overlay" ? <Overlay /> : <div />;
}

createRoot(document.getElementById("root")).render(<App />);

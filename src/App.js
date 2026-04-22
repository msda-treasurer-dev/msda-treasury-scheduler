import React, { useState, useMemo, useRef, useEffect } from "react";

// ✏️  Firebase database URL
const FIREBASE_URL = "https://msda-treasury-default-rtdb.firebaseio.com";

// Firebase helpers — read and write using simple fetch calls
const fbGet = async (path) => {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`);
  return res.ok ? res.json() : null;
};
const fbSet = async (path, data) => {
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

// ─────────────────────────────────────────────
// ✏️  EASY EDIT ZONE
// To add team members: add names to this array
// To add more Saturdays: change the number in getSaturdays() below
// ─────────────────────────────────────────────
const TEAM_MEMBERS = [
  "Roshane Nembhard",
  "Cynthia Francis",
  "Tamalia Kidd",
  "Lurline Moore",
  "Henderson Henry",
  "Pete McKenzie",
  "Fay Davis",
];

// ✏️  Add pairs of people who should NEVER be scheduled together automatically.
// Each entry is [Person A, Person B] — order doesn't matter.
const RESTRICTED_PAIRS = [
  ["Roshane Nembhard", "Cynthia Francis"],
  // Add more pairs here, e.g: ["Tamara Kidd", "Pete McKenzie"],
];

// Helper: returns true if two people are a restricted pair
function isRestrictedPair(a, b) {
  return RESTRICTED_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// ✏️  Change the number below to show more or fewer Saturdays (currently 8)
function getSaturdays(count = 9) {
  const saturdays = [];
  const start = new Date(2026, 4, 2); // ✏️  Change start date here if needed
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    saturdays.push(d);
  }
  return saturdays;
}
// ─────────────────────────────────────────────

const SATURDAYS = getSaturdays();

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtShort(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtWhatsApp(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function initUnavailability() {
  const u = {};
  TEAM_MEMBERS.forEach(m => { u[m] = {}; });
  return u;
}

function autoSchedule(unavailability) {
  const shiftCount = {};
  TEAM_MEMBERS.forEach(m => { shiftCount[m] = 0; });
  const schedule = {};
  SATURDAYS.forEach((_, i) => {
    const unavail = TEAM_MEMBERS.filter(m => unavailability[m]?.[i]);
    const available = TEAM_MEMBERS.filter(m => !unavail.includes(m));
    const sorted = [...available].sort((a, b) => {
      const diff = (shiftCount[a] || 0) - (shiftCount[b] || 0);
      return diff !== 0 ? diff : Math.random() - 0.5;
    });
    // Pick first person, then find second who isn't a restricted pair with first
    const first = sorted[0] || null;
    const second = first
      ? sorted.slice(1).find(m => !isRestrictedPair(first, m)) || null
      : null;
    const picked = [first, second].filter(Boolean);
    schedule[i] = picked;
    picked.forEach(m => { shiftCount[m] = (shiftCount[m] || 0) + 1; });
  });
  return schedule;
}

const AVATAR_COLORS = ["#4F46E5","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#2563EB","#0E7490"];

function Avatar({ name, index, size = 28 }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: AVATAR_COLORS[index % AVATAR_COLORS.length],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: "700", color: "#fff", flexShrink: 0,
    }}>{initials}</div>
  );
}

export default function TreasuryScheduler() {
  const [mode, setMode] = useState("team");
  const [activeMember, setActiveMember] = useState(TEAM_MEMBERS[0]);
  const [unavailability, setUnavailability] = useState(initUnavailability);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);

  const [saved, setSaved] = useState(false);
  const [autoMsg, setAutoMsg] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  // ✏️  Church logo — update this URL if you re-upload the logo elsewhere
  const [logo, setLogo] = useState("https://i.ibb.co/DXxq68q/MSDA-Logo.jpg");
  const [swapWeek, setSwapWeek] = useState(null);
  const [swapOut, setSwapOut] = useState(null);
  const [swapIn, setSwapIn] = useState(null);
  const logoInput = useRef();

  // ✏️  Change this password to whatever you like
  const TREASURER_PASSWORD = "treasury2026";
  const [treasurerUnlocked, setTreasurerUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Load data from Firebase on first render
  useEffect(() => {
    const loadData = async () => {
      try {
        const [savedSchedule, savedUnavail] = await Promise.all([
          fbGet("schedule"),
          fbGet("unavailability"),
        ]);
        if (savedSchedule) setSchedule(savedSchedule);
        if (savedUnavail) setUnavailability(savedUnavail);
      } catch (e) {
        console.error("Failed to load from Firebase", e);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // Save schedule to Firebase
  const updateSchedule = async (newSchedule) => {
    setSchedule(newSchedule);
    try { await fbSet("schedule", newSchedule); } catch {}
  };

  // Save unavailability to Firebase
  const saveUnavailability = async () => {
    try { await fbSet("unavailability", unavailability); } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleTreasurerClick = () => {
    if (treasurerUnlocked) {
      setMode("treasurer");
    } else {
      setShowPasswordModal(true);
      setPasswordInput("");
      setPasswordError(false);
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === TREASURER_PASSWORD) {
      setTreasurerUnlocked(true);
      setShowPasswordModal(false);
      setMode("treasurer");
      setPasswordInput("");
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setPasswordInput("");
    }
  };

  const handleLockTreasurer = () => {
    setTreasurerUnlocked(false);
    setMode("team");
  };

  const toggleUnavailable = (member, weekIdx) => {
    setUnavailability(prev => ({
      ...prev,
      [member]: { ...(prev[member] || {}), [weekIdx]: !((prev[member] || {})[weekIdx]) },
    }));
    setSaved(false);
  };

  const handleAutoSchedule = () => {
    updateSchedule(autoSchedule(unavailability));
    setAutoMsg("✓ Schedule generated — balanced by availability & shift count.");
    setTimeout(() => setAutoMsg(""), 3200);
  };

  const handleShuffle = () => {
    updateSchedule(autoSchedule(unavailability));
    setAutoMsg("✓ Reshuffled from scratch.");
    setTimeout(() => setAutoMsg(""), 3200);
  };

  const handleClearSchedule = () => {
    updateSchedule({});
    setAutoMsg("✓ Schedule cleared.");
    setTimeout(() => setAutoMsg(""), 3200);
  };

  const manualAssign = (weekIdx, slot, member) => {
    const current = [...(schedule[weekIdx] || [null, null])];
    current[slot] = member === "__clear__" ? null : member;
    updateSchedule({ ...schedule, [weekIdx]: current });
  };

  const initiateSwap = (weekIdx) => { setSwapWeek(weekIdx); setSwapOut(null); setSwapIn(null); };

  const confirmSwap = () => {
    if (swapWeek === null || !swapOut || !swapIn) return;
    const current = [...(schedule[swapWeek] || [null, null])];
    const idx = current.indexOf(swapOut);
    if (idx !== -1) current[idx] = swapIn;
    updateSchedule({ ...schedule, [swapWeek]: current });
    setAutoMsg(`✓ Swapped ${swapOut.split(" ")[0]} → ${swapIn.split(" ")[0]} on ${fmtShort(SATURDAYS[swapWeek])}`);
    setTimeout(() => setAutoMsg(""), 3200);
    setSwapWeek(null); setSwapOut(null); setSwapIn(null);
  };

  const copyForWhatsApp = () => {
    const lines = ["*TREASURY TEAM — SABBATH SCHEDULE*\n"];
    SATURDAYS.forEach((sat, i) => {
      const assigned = (schedule[i] || []).filter(Boolean);
      const names = assigned.length === 2
        ? assigned.map(m => m.split(" ")[0]).join(" & ")
        : assigned.length === 1 ? `${assigned[0].split(" ")[0]} (1 person only)` : "Not yet assigned";
      lines.push(`*${fmtWhatsApp(sat)}*\n${names}\n`);
    });
    lines.push("_Generated by Treasury Team Scheduler_");
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopyMsg("✓ Copied! Paste into WhatsApp.");
      setTimeout(() => setCopyMsg(""), 3000);
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogo(ev.target.result);
    reader.readAsDataURL(file);
  };

  const shiftCounts = useMemo(() => {
    const counts = {};
    TEAM_MEMBERS.forEach(m => { counts[m] = 0; });
    Object.values(schedule).forEach(day => {
      (day || []).forEach(m => { if (m) counts[m] = (counts[m] || 0) + 1; });
    });
    return counts;
  }, [schedule]);

  const unavailCounts = useMemo(() => {
    const counts = {};
    TEAM_MEMBERS.forEach(m => {
      counts[m] = Object.values(unavailability[m] || {}).filter(Boolean).length;
    });
    return counts;
  }, [unavailability]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <img src="https://i.ibb.co/DXxq68q/MSDA-Logo.jpg" alt="MSDA Logo" style={{ width: "72px", height: "72px", objectFit: "contain", marginBottom: "20px", borderRadius: "12px" }} />
      <div style={{ fontSize: "16px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>Loading schedule...</div>
      <div style={{ fontSize: "13px", color: "#94A3B8" }}>Syncing with database</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", color: "#1E293B", fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #E2E8F0",
        padding: "16px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            onClick={() => logoInput.current.click()}
            title="Click to upload your church logo"
            style={{
              width: "48px", height: "48px", borderRadius: "10px",
              background: logo ? "transparent" : "#F1F5F9",
              border: logo ? "none" : "2px dashed #CBD5E1",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", overflow: "hidden", flexShrink: 0,
              transition: "border-color 0.2s",
            }}
          >
            {logo
              ? <img src={logo} alt="Church logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <span style={{ fontSize: "20px" }}>⛪</span>
            }
          </div>
          <input ref={logoInput} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />

          <div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#0F172A", letterSpacing: "-0.01em" }}>Mississauga SDA Treasury Team</div>
            <div style={{ fontSize: "15px", color: "#94A3B8", letterSpacing: "0.04em" }}>Sabbath Coverage Scheduler</div>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "2px", background: "#F1F5F9", borderRadius: "10px", padding: "3px", border: "1px solid #E2E8F0" }}>
          <button onClick={() => setMode("team")} style={{
            padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: "12px", fontWeight: "600",
            background: mode === "team" ? "#fff" : "transparent",
            color: mode === "team" ? "#4F46E5" : "#94A3B8",
            boxShadow: mode === "team" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.2s",
          }}>👤  My Availability</button>
          <button onClick={() => setMode("schedule")} style={{
            padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: "12px", fontWeight: "600",
            background: mode === "schedule" ? "#fff" : "transparent",
            color: mode === "schedule" ? "#4F46E5" : "#94A3B8",
            boxShadow: mode === "schedule" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.2s",
          }}>📅  Schedule</button>
          <button onClick={handleTreasurerClick} style={{
            padding: "8px 18px", borderRadius: "8px", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: "12px", fontWeight: "600",
            background: mode === "treasurer" ? "#fff" : "transparent",
            color: mode === "treasurer" ? "#4F46E5" : "#94A3B8",
            boxShadow: mode === "treasurer" ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.2s",
          }}>🏦  Treasurer {treasurerUnlocked ? "🔓" : "🔒"}</button>
        </div>

        {!logo && (
          <div onClick={() => logoInput.current.click()} style={{
            fontSize: "11px", color: "#94A3B8", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "5px",
          }}>
            <span>📎</span> Click the icon to add your church logo
          </div>
        )}
      </div>

      <div style={{ padding: "24px 28px" }}>

        {/* ── TEAM MEMBER VIEW ── */}
        {mode === "team" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "10px" }}>Select Your Name</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {TEAM_MEMBERS.map((m, i) => (
                  <button key={m} onClick={() => { setActiveMember(m); setSaved(false); }} style={{
                    padding: "8px 14px", borderRadius: "8px",
                    border: `1.5px solid ${activeMember === m ? "#4F46E5" : "#E2E8F0"}`,
                    background: activeMember === m ? "#EEF2FF" : "#fff",
                    color: activeMember === m ? "#4F46E5" : "#475569",
                    cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: "500",
                    display: "flex", alignItems: "center", gap: "8px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "all 0.15s",
                  }}>
                    <Avatar name={m} index={i} size={22} />
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "13px" }}>
              Tap any Sabbath you are unavailable
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px,1fr))", gap: "10px" }}>
              {SATURDAYS.map((sat, i) => {
                const isUnavail = !!unavailability[activeMember]?.[i];
                const isAssigned = (schedule[i] || []).includes(activeMember);
                return (
                  <div key={i} onClick={() => toggleUnavailable(activeMember, i)} style={{
                    background: "#fff",
                    border: `2px solid ${isUnavail ? "#FCA5A5" : "#BBF7D0"}`,
                    borderRadius: "12px", padding: "15px 14px",
                    cursor: "pointer", transition: "all 0.2s", userSelect: "none",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}>
                    <div style={{ fontSize: "10px", fontWeight: "600", color: "#94A3B8", letterSpacing: "0.06em", marginBottom: "4px" }}>
                    Sat
                    </div>
                    <div style={{ fontSize: "13px", color: "#1E293B", fontWeight: "600", marginBottom: "10px" }}>{fmtDate(sat)}</div>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      padding: "4px 10px", borderRadius: "20px",
                      background: isUnavail ? "#FEF2F2" : "#F0FDF4",
                      border: `1px solid ${isUnavail ? "#FECACA" : "#BBF7D0"}`,
                      fontSize: "11px", fontWeight: "600",
                      color: isUnavail ? "#EF4444" : "#16A34A",
                    }}>
                      {isUnavail ? "✗ Unavailable" : "✓ Available"}
                    </div>
                    {isAssigned && (
                      <div style={{ marginTop: "8px", fontSize: "11px", color: "#4F46E5", fontWeight: "600" }}>★ You're scheduled</div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={saveUnavailability} style={{
              marginTop: "20px",
              background: saved ? "#16A34A" : "#4F46E5",
              border: "none", borderRadius: "9px", padding: "11px 24px",
              color: "#fff", cursor: "pointer", fontFamily: "inherit",
              fontSize: "13px", fontWeight: "600", transition: "all 0.3s",
              boxShadow: "0 2px 8px rgba(79,70,229,0.3)",
            }}>{saved ? "✓  Availability Saved" : "Save Availability"}</button>
          </div>
        )}

        {/* ── SCHEDULE SUMMARY VIEW ── */}
        {mode === "schedule" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Sabbath Schedule</div>
              <div style={{ fontSize: "13px", color: "#94A3B8" }}>Published by the Treasurer. Read-only view for the team.</div>
            </div>

            {Object.keys(schedule).length === 0 || SATURDAYS.every((_, i) => !(schedule[i] || []).some(Boolean)) ? (
              <div style={{
                background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px",
                padding: "48px 24px", textAlign: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
                <div style={{ fontSize: "16px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>No schedule yet</div>
                <div style={{ fontSize: "13px", color: "#94A3B8" }}>The Treasurer hasn't published a schedule yet. Check back soon!</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {SATURDAYS.map((sat, i) => {
                  const assigned = (schedule[i] || []).filter(Boolean);
                  const hasAssignment = assigned.length === 2;
                  return (
                    <div key={i} style={{
                      background: "#fff",
                      border: `1.5px solid ${hasAssignment ? "#E2E8F0" : "#F1F5F9"}`,
                      borderRadius: "12px", padding: "16px",
                      boxShadow: hasAssignment ? "0 1px 4px rgba(0,0,0,0.05)" : "none",
                      opacity: hasAssignment ? 1 : 0.5,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                        <div style={{
                          minWidth: "72px", textAlign: "center",
                          background: hasAssignment ? "#EEF2FF" : "#F8FAFC",
                          borderRadius: "10px", padding: "8px 6px", flexShrink: 0,
                        }}>
                          <div style={{ fontSize: "10px", fontWeight: "700", color: "#6366F1", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            {sat.toLocaleDateString("en-GB", { month: "short" })}
                          </div>
                          <div style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", lineHeight: 1.1 }}>
                            {sat.getDate()}
                          </div>
                          <div style={{ fontSize: "10px", color: "#94A3B8", fontWeight: "500" }}>
                            {sat.getFullYear()}
                          </div>
                        </div>

                        <div style={{ flex: 1, minWidth: "0" }}>
                          {hasAssignment ? (
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>On Duty</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {assigned.map(m => (
                                  <div key={m} style={{
                                    display: "inline-flex", alignItems: "center", gap: "8px",
                                    background: "#F8FAFC", border: "1px solid #E2E8F0",
                                    borderRadius: "8px", padding: "7px 10px",
                                    width: "fit-content",
                                  }}>
                                    <Avatar name={m} index={TEAM_MEMBERS.indexOf(m)} size={26} />
                                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{m}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: "13px", color: "#CBD5E1", fontStyle: "italic" }}>Not yet assigned</div>
                          )}
                        </div>
                      </div>

                      {hasAssignment && (
                        <div style={{ marginTop: "10px" }}>
                          <span style={{
                            display: "inline-block",
                            background: "#F0FDF4", border: "1px solid #BBF7D0",
                            borderRadius: "20px", padding: "4px 14px",
                            fontSize: "11px", fontWeight: "600", color: "#16A34A",
                          }}>✓ Covered</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TREASURER VIEW ── */}
        {mode === "treasurer" && (
          <div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "22px", flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={handleAutoSchedule} style={wb("primary")}>⚡ Auto-Schedule</button>
              <button onClick={handleShuffle} style={wb("outline")}>🔀 Reshuffle</button>
              <button onClick={handleClearSchedule} style={wb("red")}>✕ Clear Schedule</button>
              <button onClick={copyForWhatsApp} style={wb("green")}>📋 Copy Schedule</button>
              <button onClick={handleLockTreasurer} style={wb("lock")}>🔒 Lock</button>
              {(autoMsg || copyMsg) && (
                <div style={{ fontSize: "12px", color: "#16A34A", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "8px 14px", fontWeight: "500" }}>
                  {autoMsg || copyMsg}
                </div>
              )}
            </div>

            <div style={{ marginBottom: "22px" }}>
              <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "10px" }}>Shift Balance</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {TEAM_MEMBERS.map((m, i) => {
                  const count = shiftCounts[m] || 0;
                  const unavail = unavailCounts[m] || 0;
                  const pct = (count / SATURDAYS.length) * 100;
                  const barColor = count <= 1 ? "#22C55E" : count <= 3 ? "#4F46E5" : "#F59E0B";
                  return (
                    <div key={m} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 13px", minWidth: "145px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
                        <Avatar name={m} index={i} size={22} />
                        <span style={{ fontSize: "12px", color: "#334155", fontWeight: "500" }}>{m.split(" ")[0]}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "5px" }}>
                        <span style={{ color: "#4F46E5", fontWeight: "600" }}>{count} shifts</span>
                        {unavail > 0 && <span style={{ color: "#F59E0B", fontWeight: "500" }}>{unavail} unavailable</span>}
                      </div>
                      <div style={{ height: "5px", background: "#F1F5F9", borderRadius: "3px" }}>
                        <div style={{ height: "100%", borderRadius: "3px", width: `${pct}%`, background: barColor, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "12px" }}>Sabbath Schedule — 2 People Per Week</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {SATURDAYS.map((sat, i) => {
                const assigned = schedule[i] || [null, null];
                const unavailForDay = TEAM_MEMBERS.filter(m => unavailability[m]?.[i]);
                const availForDay = TEAM_MEMBERS.filter(m => !unavailability[m]?.[i]);
                const hasConflict = assigned.some(m => m && unavailForDay.includes(m));
                const hasDuplicate = assigned[0] && assigned[1] && assigned[0] === assigned[1];
                const hasRestrictedPair = assigned[0] && assigned[1] && isRestrictedPair(assigned[0], assigned[1]);
                const isSwapping = swapWeek === i;

                return (
                  <div key={i} style={{
                    background: "#fff",
                    border: `1.5px solid ${hasConflict || hasDuplicate ? "#FECACA" : hasRestrictedPair ? "#FDE68A" : isSwapping ? "#A5B4FC" : "#E2E8F0"}`,
                    borderRadius: "12px", padding: "14px 16px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                      <div style={{ minWidth: "100px" }}>
                        <div style={{ fontSize: "10px", fontWeight: "600", color: "#94A3B8", letterSpacing: "0.06em" }}>Saturday</div>
                        <div style={{ fontSize: "14px", color: "#0F172A", fontWeight: "700" }}>{fmtShort(sat)}</div>
                      </div>

                      <SlotPicker slot={0} value={assigned[0]} available={availForDay} unavailable={unavailForDay} allMembers={TEAM_MEMBERS} otherSelected={assigned[1]} shiftCounts={shiftCounts} onChange={m => manualAssign(i, 0, m)} />
                      <SlotPicker slot={1} value={assigned[1]} available={availForDay} unavailable={unavailForDay} allMembers={TEAM_MEMBERS} otherSelected={assigned[0]} shiftCounts={shiftCounts} onChange={m => manualAssign(i, 1, m)} />

                      <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        {unavailForDay.length > 0 && (
                          <span style={{ fontSize: "11px", color: "#F59E0B", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "6px", padding: "3px 8px", fontWeight: "500" }}>
                            Unavailable: {unavailForDay.map(m => m.split(" ")[0]).join(", ")}
                          </span>
                        )}
                        {hasConflict && <span style={{ fontSize: "11px", color: "#EF4444", fontWeight: "700", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "3px 8px" }}>⚠ Conflict!</span>}
                        {hasDuplicate && <span style={{ fontSize: "11px", color: "#EF4444", fontWeight: "700", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "3px 8px" }}>⚠ Same person twice!</span>}
                        {hasRestrictedPair && <span style={{ fontSize: "11px", color: "#92400E", fontWeight: "500", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "6px", padding: "3px 8px" }}>⚠  Note: Head & Assistant paired </span>}
                        {(assigned[0] || assigned[1]) && (
                          <button onClick={() => isSwapping ? setSwapWeek(null) : initiateSwap(i)} style={{
                            background: isSwapping ? "#EEF2FF" : "#F8FAFC",
                            border: `1.5px solid ${isSwapping ? "#A5B4FC" : "#E2E8F0"}`,
                            borderRadius: "7px", padding: "6px 12px", cursor: "pointer",
                            color: isSwapping ? "#4F46E5" : "#64748B",
                            fontFamily: "inherit", fontSize: "12px", fontWeight: "600",
                          }}>⇄ {isSwapping ? "Cancel" : "Swap"}</button>
                        )}
                      </div>
                    </div>

                    {isSwapping && (
                      <div style={{ marginTop: "14px", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "14px 16px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#6D28D9", letterSpacing: "0.06em", marginBottom: "12px", textTransform: "uppercase" }}>
                          Last-Minute Swap — {fmtShort(sat)}
                        </div>
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>Who can't make it</div>
                            <div style={{ display: "flex", gap: "7px" }}>
                              {(assigned).filter(Boolean).map((m) => (
                                <button key={m} onClick={() => { setSwapOut(m); setSwapIn(null); }} style={{
                                  background: swapOut === m ? "#EDE9FE" : "#fff",
                                  border: `1.5px solid ${swapOut === m ? "#7C3AED" : "#E2E8F0"}`,
                                  borderRadius: "8px", padding: "7px 12px", cursor: "pointer",
                                  color: swapOut === m ? "#6D28D9" : "#475569",
                                  fontFamily: "inherit", fontSize: "12px", fontWeight: "600",
                                  display: "flex", alignItems: "center", gap: "7px",
                                }}>
                                  <Avatar name={m} index={TEAM_MEMBERS.indexOf(m)} size={18} />
                                  {m.split(" ")[0]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {swapOut && (
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase" }}>Replacement</div>
                              <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                                {TEAM_MEMBERS.filter(m => m !== swapOut && !(assigned || []).includes(m)).map((m) => {
                                  const isUnavailNow = unavailability[m]?.[i];
                                  return (
                                    <button key={m} onClick={() => !isUnavailNow && setSwapIn(m)} style={{
                                      background: swapIn === m ? "#F0FDF4" : "#fff",
                                      border: `1.5px solid ${swapIn === m ? "#22C55E" : isUnavailNow ? "#F1F5F9" : "#E2E8F0"}`,
                                      borderRadius: "8px", padding: "7px 12px",
                                      cursor: isUnavailNow ? "not-allowed" : "pointer",
                                      color: isUnavailNow ? "#CBD5E1" : swapIn === m ? "#16A34A" : "#475569",
                                      fontFamily: "inherit", fontSize: "12px", fontWeight: "600",
                                      display: "flex", alignItems: "center", gap: "7px",
                                      opacity: isUnavailNow ? 0.5 : 1,
                                    }}>
                                      <Avatar name={m} index={TEAM_MEMBERS.indexOf(m)} size={18} />
                                      {m.split(" ")[0]}
                                      {isUnavailNow && <span style={{ fontSize: "9px", color: "#F59E0B" }}>unavailable</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {swapOut && swapIn && (
                            <button onClick={confirmSwap} style={{
                              background: "#16A34A", border: "none", borderRadius: "8px",
                              padding: "10px 18px", color: "#fff", cursor: "pointer",
                              fontFamily: "inherit", fontSize: "12px", fontWeight: "700",
                            }}>✓ Confirm Swap</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }} onClick={() => setShowPasswordModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: "16px", padding: "32px",
            width: "320px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: "28px", textAlign: "center", marginBottom: "8px" }}>🏦</div>
            <div style={{ fontSize: "17px", fontWeight: "700", color: "#0F172A", textAlign: "center", marginBottom: "4px" }}>Treasurer Access</div>
            <div style={{ fontSize: "13px", color: "#94A3B8", textAlign: "center", marginBottom: "24px" }}>Enter the password to continue</div>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()}
              placeholder="Password"
              autoFocus
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "9px",
                border: `1.5px solid ${passwordError ? "#FECACA" : "#E2E8F0"}`,
                fontFamily: "inherit", fontSize: "14px", outline: "none",
                background: passwordError ? "#FEF2F2" : "#F8FAFC",
                color: "#0F172A", boxSizing: "border-box", marginBottom: "8px",
              }}
            />
            {passwordError && (
              <div style={{ fontSize: "12px", color: "#EF4444", marginBottom: "12px", fontWeight: "500" }}>
                ✕ Incorrect password. Please try again.
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button onClick={() => setShowPasswordModal(false)} style={{
                flex: 1, padding: "10px", borderRadius: "8px", border: "1.5px solid #E2E8F0",
                background: "#fff", color: "#64748B", fontFamily: "inherit", fontSize: "13px",
                fontWeight: "600", cursor: "pointer",
              }}>Cancel</button>
              <button onClick={handlePasswordSubmit} style={{
                flex: 1, padding: "10px", borderRadius: "8px", border: "none",
                background: "#4F46E5", color: "#fff", fontFamily: "inherit", fontSize: "13px",
                fontWeight: "600", cursor: "pointer", boxShadow: "0 2px 8px rgba(79,70,229,0.3)",
              }}>Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function wb(type) {
  const base = { border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s" };
  if (type === "primary") return { ...base, background: "#4F46E5", color: "#fff", boxShadow: "0 2px 8px rgba(79,70,229,0.25)" };
  if (type === "outline") return { ...base, background: "#fff", border: "1.5px solid #E2E8F0", color: "#475569" };
  if (type === "green") return { ...base, background: "#F0FDF4", border: "1.5px solid #BBF7D0", color: "#16A34A" };
  if (type === "red") return { ...base, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#EF4444" };
  if (type === "lock") return { ...base, background: "#F8FAFC", border: "1.5px solid #E2E8F0", color: "#64748B" };
  return base;
}

function SlotPicker({ slot, value, available, unavailable, allMembers, otherSelected, shiftCounts, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Person {slot + 1}</div>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} style={{
        background: value ? "#EEF2FF" : "#F8FAFC",
        border: `1.5px solid ${value ? "#A5B4FC" : "#E2E8F0"}`,
        borderRadius: "9px", padding: "8px 13px", cursor: "pointer",
        color: value ? "#4F46E5" : "#94A3B8",
        fontSize: "13px", fontFamily: "inherit", fontWeight: value ? "600" : "400",
        display: "flex", alignItems: "center", gap: "8px",
        minWidth: "175px", transition: "all 0.15s",
      }}>
        {value ? (<><Avatar name={value} index={allMembers.indexOf(value)} size={20} /><span>{value}</span></>) : <span>— Select person —</span>}
        <span style={{ marginLeft: "auto", color: "#CBD5E1", fontSize: "10px" }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            background: "#fff", border: "1px solid #E2E8F0",
            borderRadius: "12px", padding: "8px", zIndex: 300,
            minWidth: "215px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}>
            {value && (
              <button onClick={() => { onChange("__clear__"); setOpen(false); }} style={ds("#EF4444", false)}>
                <span>✕ Clear selection</span>
              </button>
            )}
            {allMembers.map((m, i) => {
              const isUnavail = unavailable.includes(m);
              const isSelf = m === otherSelected;
              const isRestricted = otherSelected && isRestrictedPair(m, otherSelected);
              const disabled = isUnavail || isSelf;
              return (
                <button key={m} disabled={disabled} onClick={() => { if (!disabled) { onChange(m); setOpen(false); } }} style={ds(isUnavail ? "#F59E0B" : isSelf ? "#94A3B8" : "#1E293B", disabled)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Avatar name={m} index={i} size={20} />
                    <span>{m}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: "600" }}>{shiftCounts[m] || 0}×</span>
                    {isUnavail && <span style={{ fontSize: "9px", color: "#F59E0B", background: "#FFFBEB", borderRadius: "4px", padding: "1px 5px" }}>unavail</span>}
                    {isRestricted && <span style={{ fontSize: "9px", color: "#92400E", background: "#FFFBEB", borderRadius: "4px", padding: "1px 5px" }}>usually separate</span>}
                    {isSelf && <span style={{ fontSize: "9px", color: "#94A3B8", background: "#F1F5F9", borderRadius: "4px", padding: "1px 5px" }}>selected</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
        </>
      )}
    </div>
  );
}

function ds(color, disabled) {
  return {
    width: "100%", background: "transparent", border: "1px solid transparent",
    borderRadius: "8px", padding: "8px 10px", cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "#CBD5E1" : color, fontSize: "12px", fontFamily: "inherit", fontWeight: "500",
    textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center",
    opacity: disabled ? 0.5 : 1, transition: "background 0.1s",
  };
}


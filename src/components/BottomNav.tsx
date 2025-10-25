import React from "react";

type TabKey = "home"|"games"|"profiles"|"friends"|"all"|"stats"|"settings";
type NavItem = { k: TabKey; label: string; icon: React.ReactNode };

function Icon({name,size=22}:{name:TabKey;size?:number}){
  const p = { fill:"none", stroke:"currentColor", strokeWidth:2, strokeLinecap:"round", strokeLinejoin:"round" } as const;
  switch(name){
    case "home":      return <svg width={size} height={size} viewBox="0 0 24 24"><path {...p} d="M3 11.5 12 4l9 7.5"/><path {...p} d="M5 10.5V20h14v-9.5"/></svg>;
    case "games":     return <svg width={size} height={size} viewBox="0 0 24 24"><path {...p} d="M4 15a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5"/><circle cx="8.5" cy="13" r="1.7" fill="currentColor"/><circle cx="15.5" cy="13" r="1.7" fill="currentColor"/><path {...p} d="M2 15h20"/></svg>;
    case "profiles":  return <svg width={size} height={size} viewBox="0 0 24 24"><path {...p} d="M4 20a6.5 6.5 0 0 1 16 0"/><circle {...p} cx="12" cy="8" r="3.6"/></svg>;
    case "friends":   return <svg width={size} height={size} viewBox="0 0 24 24"><path {...p} d="M3 20a5.5 5.5 0 0 1 8.5-4.8"/><path {...p} d="M21 20a5.5 5.5 0 0 0-8.5-4.8"/><circle {...p} cx="7.5" cy="9" r="2.9"/><circle {...p} cx="16.5" cy="9" r="2.9"/></svg>;
    case "stats":     return <svg width={size} height={size} viewBox="0 0 24 24"><path {...p} d="M4 20V7"/><path {...p} d="M10 20V4"/><path {...p} d="M16 20v-6"/><path {...p} d="M22 20V9"/></svg>;
    case "settings":  return <svg width={size} height={size} viewBox="0 0 24 24"><path {...p} d="m12 3 1.6 2.4a2 2 0 0 0 1.1.8l2.8.7-.7 2.8a2 2 0 0 0 .2 1.4l1.4 2.3-2.3 1.4a2 2 0 0 0-1 .9l-.8 2.7-2.8-.6a2 2 0 0 0-1.4.2L9 21l-1.4-2.3a2 2 0 0 0-.9-1l-2.7-.8.6-2.8a2 2 0 0 0-.2-1.4L3 9l2.3-1.4a2 2 0 0 0 1-.9l.8-2.7 2.8.6a2 2 0 0 0 1.4-.2Z"/><circle {...p} cx="12" cy="12" r="2.8"/></svg>;
  }
}

export default function BottomNav({
  value,
  onChange,
}: { value: TabKey; onChange: (k: TabKey) => void; }) {

  const tabs: NavItem[] = [
    { k:"home",     label:"Accueil",   icon:<Icon name="home"     /> },
    { k:"games",    label:"Jeux",      icon:<Icon name="games"    /> },
    { k:"profiles", label:"Profils",   icon:<Icon name="profiles" /> },
    { k:"friends",  label:"Amis",      icon:<Icon name="friends"  /> },
    { k:"stats",    label:"Stats",     icon:<Icon name="stats"    /> },
    { k:"settings", label:"Réglages",  icon:<Icon name="settings" /> },
  ];

  const tap = (k: TabKey) => { (navigator as any)?.vibrate?.(8); onChange(k); };

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navigation principale">
      {tabs.map(t=>{
        const active = value===t.k;
        return (
          <button
            key={t.k}
            className={`tab pill ${active?"is-active":""}`}
            onClick={()=>tap(t.k)}
            aria-current={active?"page":undefined}
            title={t.label}
          >
            <span className="pill-inner">
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </span>
          </button>
        );
      })}
      <div className="bn-safe" />
    </nav>
  );
}

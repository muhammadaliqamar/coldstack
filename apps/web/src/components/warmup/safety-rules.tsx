'use client';
import { NEVER_RULES, ALWAYS_RULES } from '@/lib/warmup-policy';
import { ShieldCheck, ShieldX, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SafetyProps {
  bounceRate: number;
  bounceRateOk: boolean;
  isFridayPrayerTime: boolean;
  isWeekend: boolean;
  warmupScore: number;
}

export function SafetyRulesPanel({ bounceRate, bounceRateOk, isFridayPrayerTime, isWeekend, warmupScore }: SafetyProps) {
  const [expanded, setExpanded] = useState(false);

  const liveChecks = [
    { label: 'Bounce rate < 2%', ok: bounceRateOk, detail: `${bounceRate}%` },
    { label: 'Friday prayer block', ok: !isFridayPrayerTime, detail: isFridayPrayerTime ? 'Active — paused' : 'Not active' },
    { label: 'Weekend throttle', ok: true, detail: isWeekend ? 'Active — limited to 1-2' : 'Not active' },
    { label: 'Outreach readiness', ok: warmupScore >= 80, detail: warmupScore >= 80 ? 'Score ≥ 80 ✓' : `Score ${warmupScore} — not ready` },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10"><ShieldCheck className="w-5 h-5 text-violet-500" /></div>
          <div className="text-left">
            <h3 className="font-bold text-sm text-foreground">Safety Rules & Policy Compliance</h3>
            <p className="text-xs text-muted-foreground">{liveChecks.filter(c => c.ok).length}/{liveChecks.length} checks passing</p>
          </div>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Live status — always visible */}
      <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        {liveChecks.map((c, i) => (
          <div key={i} className={cn("rounded-xl px-3 py-2 border text-xs", c.ok ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20")}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", c.ok ? "bg-emerald-500" : "bg-red-500 animate-pulse")} />
              <span className="font-semibold text-foreground">{c.label}</span>
            </div>
            <span className="text-muted-foreground">{c.detail}</span>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="border-t px-4 py-4 grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldX className="w-4 h-4 text-red-500" />
              <h4 className="font-bold text-sm text-red-500">NEVER Rules</h4>
            </div>
            <ul className="space-y-1.5">
              {NEVER_RULES.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-red-500 font-bold shrink-0">✕</span>{r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <h4 className="font-bold text-sm text-emerald-500">ALWAYS Rules</h4>
            </div>
            <ul className="space-y-1.5">
              {ALWAYS_RULES.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>{r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { WEEK_SCHEDULE, SPLIT_COLORS } from '@/lib/warmup-policy';
import { CheckCircle, Target, Flame, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoadmapProps { currentWeek: number; warmupScore: number; status: string; }

export function WarmupRoadmap({ currentWeek, warmupScore, status }: RoadmapProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-amber-500/10"><Flame className="w-5 h-5 text-amber-500" /></div>
        <div>
          <h3 className="font-bold text-lg text-foreground">6-Week Warmup Roadmap</h3>
          <p className="text-sm text-muted-foreground">Progressive volume increase with recipient diversification</p>
        </div>
      </div>
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-6 left-6 right-6 h-1 bg-muted rounded-full z-0">
          <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(((Math.max(currentWeek,1) - 1) / 5) * 100, 100)}%` }} />
        </div>
        <div className="relative z-10 grid grid-cols-6 gap-2">
          {WEEK_SCHEDULE.map((w) => {
            const isCompleted = currentWeek > w.week || (status === 'ready' && w.week <= currentWeek);
            const isCurrent = currentWeek === w.week && status !== 'ready' && status !== 'idle';
            const isFuture = currentWeek < w.week;
            return (
              <div key={w.week} className={cn("flex flex-col items-center text-center group", isFuture && "opacity-40")}>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all mb-3",
                  isCompleted && "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20",
                  isCurrent && "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30 animate-pulse",
                  isFuture && "bg-muted border-border text-muted-foreground",
                  !isCompleted && !isCurrent && !isFuture && "bg-muted border-border text-muted-foreground"
                )}>
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : isFuture ? <Lock className="w-4 h-4" /> : w.week}
                </div>
                <p className={cn("text-xs font-bold mb-0.5", isCurrent ? "text-amber-500" : isCompleted ? "text-emerald-500" : "text-muted-foreground")}>
                  Week {w.week}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight mb-2 max-w-[100px]">{w.goal}</p>
                <div className="text-[10px] space-y-0.5 w-full">
                  <div className="flex justify-center gap-1 font-mono">
                    <span className="text-foreground font-bold">{w.daily}</span>
                    <span className="text-muted-foreground">/day</span>
                  </div>
                  <div className="flex justify-center gap-1">
                    <Target className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{w.scoreRange}</span>
                  </div>
                  {/* Recipient split mini-bar */}
                  <div className="flex gap-px h-1.5 rounded-full overflow-hidden mt-1 mx-2">
                    {w.internal > 0 && <div className={cn(SPLIT_COLORS.internal.bg, "transition-all")} style={{ flex: w.internal }} />}
                    {w.gmail > 0 && <div className={cn(SPLIT_COLORS.gmail.bg, "transition-all")} style={{ flex: w.gmail }} />}
                    {w.outlook > 0 && <div className={cn(SPLIT_COLORS.outlook.bg, "transition-all")} style={{ flex: w.outlook }} />}
                    {w.real > 0 && <div className={cn(SPLIT_COLORS.real.bg, "transition-all")} style={{ flex: w.real }} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-5 pt-4 border-t border-border/50">
          {Object.entries(SPLIT_COLORS).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-full", val.bg)} />
              <span className="text-[10px] text-muted-foreground font-medium">{val.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

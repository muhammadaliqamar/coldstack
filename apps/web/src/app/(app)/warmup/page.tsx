'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Play, Pause, Flame, CheckCircle, Globe, Activity, Mail, AlertTriangle, Send, Square, Clock, Target, Rocket, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { WEEK_SCHEDULE, SPLIT_COLORS } from '@/lib/warmup-policy';
import { WarmupRoadmap } from '@/components/warmup/roadmap';
import { SafetyRulesPanel } from '@/components/warmup/safety-rules';

export default function WarmupPage() {
  const queryClient = useQueryClient();
  const [selectedInboxForPolicy, setSelectedInboxForPolicy] = useState<string | null>(null);

  const { data: inboxes, isLoading } = useQuery({
    queryKey: ['inboxes'],
    queryFn: () => fetchApi('/inboxes'),
  });

  const groupedInboxes = useMemo(() => {
    if (!inboxes) return {};
    return inboxes.reduce((acc: any, inbox: any) => {
      if (!acc[inbox.domainName]) acc[inbox.domainName] = [];
      acc[inbox.domainName].push(inbox);
      return acc;
    }, {});
  }, [inboxes]);

  const domainNames = Object.keys(groupedInboxes);

  // Policy data for selected inbox
  const { data: policyData } = useQuery({
    queryKey: ['warmup-policy', selectedInboxForPolicy],
    queryFn: () => fetchApi(`/inboxes/${selectedInboxForPolicy}/warmup-policy`),
    enabled: !!selectedInboxForPolicy,
  });

  // Auto-select first warming inbox for policy display
  const firstWarmingInbox = useMemo(() => {
    if (!inboxes) return null;
    return inboxes.find((i: any) => i.warmupStatus === 'warming') || inboxes.find((i: any) => i.warmupWeek > 0) || (inboxes.length > 0 ? inboxes[0] : null);
  }, [inboxes]);

  if (firstWarmingInbox && !selectedInboxForPolicy) {
    setSelectedInboxForPolicy(firstWarmingInbox.id);
  }

  const [logsInboxId, setLogsInboxId] = useState<string | null>(null);
  const { data: warmupLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['warmup-logs', logsInboxId],
    queryFn: () => fetchApi(`/inboxes/${logsInboxId}/warmup-logs`),
    enabled: !!logsInboxId,
  });

  const toggleWarmupMutation = useMutation({
    mutationFn: ({ id, action }: { id: string, action: 'start' | 'pause' | 'resume' | 'stop' }) =>
      fetchApi(`/inboxes/${id}/${action}-warmup`, { method: 'POST' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inboxes'] }); toast.success('Warmup status updated'); },
    onError: (err: any) => toast.error(err.message),
  });

  const startWarmupMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/inboxes/${id}/start-warmup`, { method: 'POST' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inboxes'] }); toast.success('Warmup started'); },
    onError: (err: any) => toast.error(err.message),
  });

  const bulkActionMutation = useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'stop') => fetchApi(`/inboxes/bulk/${action}-warmup`, { method: 'POST' }),
    onSuccess: (data: any) => { queryClient.invalidateQueries({ queryKey: ['inboxes'] }); toast.success(data.message || `Warmup ${data.action}d successfully`); },
    onError: (err: any) => toast.error(err.message),
  });

  const approveWeekMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/inboxes/${id}/approve-week`, { method: 'POST' }),
    onSuccess: (data: any) => { queryClient.invalidateQueries({ queryKey: ['inboxes'] }); toast.success(data.message || 'Week approved!'); },
    onError: (err: any) => toast.error(err.message),
  });

  const startWarmupForAll = (domain: string) => {
    const toWarmup = groupedInboxes[domain]?.filter((i: any) => i.warmupStatus !== 'warming' && i.warmupStatus !== 'ready') || [];
    if (toWarmup.length === 0) { toast.info('All inboxes are already warming up or ready.'); return; }
    toWarmup.forEach((inbox: any) => startWarmupMutation.mutate(inbox.id));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent"><CheckCircle className="w-3 h-3 mr-1" /> Ready</Badge>;
      case 'warming': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white animate-pulse border-transparent shadow-md font-bold px-3"><Flame className="w-3.5 h-3.5 mr-1" /> Warming</Badge>;
      case 'paused': return <Badge variant="outline" className="opacity-70"><Pause className="w-3 h-3 mr-1" /> Paused</Badge>;
      default: return <Badge variant="outline" className="opacity-70">Idle</Badge>;
    }
  };

  // Determine global warmup week for roadmap
  const globalWeek = policyData?.currentWeek || (firstWarmingInbox?.warmupWeek || 0);
  const globalScore = policyData?.warmupScore || (firstWarmingInbox?.warmupScore || 0);
  const globalStatus = policyData?.warmupStatus || (firstWarmingInbox?.warmupStatus || 'idle');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
          <Flame className="w-8 h-8 mr-3 text-amber-500" />
          Warmup Monitor
        </h2>
        <p className="text-muted-foreground mt-1 text-lg">Track and optimize deliverability across your domains.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Activity className="w-8 h-8 animate-spin text-primary opacity-50" /></div>
      ) : domainNames.length === 0 ? (
        <Card className="p-16 text-center flex flex-col items-center justify-center border-dashed bg-card/50">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6"><Flame className="w-10 h-10 text-muted-foreground opacity-40" /></div>
          <h3 className="text-2xl font-bold mb-2">No Warmup Data Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-8 text-lg">Add domains and create inboxes to start warming them up.</p>
          <Link href="/domains" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-8 shadow-md")}>Go to Domains</Link>
        </Card>
      ) : (
        <>
          {/* Roadmap */}
          {globalWeek > 0 && <WarmupRoadmap currentWeek={globalWeek} warmupScore={globalScore} status={globalStatus} />}

          {/* Ready Banner */}
          {policyData?.fullyReady && (
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/20"><Rocket className="w-6 h-6 text-emerald-500" /></div>
              <div className="flex-1">
                <h3 className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">✅ Warmup Complete — Ready for Outreach!</h3>
                <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                  <span>• Start real outreach at <strong className="text-foreground">20/inbox/day</strong></span>
                  <span>• Keep warmup running at <strong className="text-foreground">10/inbox/day</strong></span>
                </div>
              </div>
              <Link href="/campaigns" className={cn(buttonVariants(), "bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6")}>
                <Rocket className="w-4 h-4 mr-2" />Start Campaign
              </Link>
            </div>
          )}

          {/* Safety Rules */}
          {policyData && (
            <SafetyRulesPanel
              bounceRate={policyData.bounceRate}
              bounceRateOk={policyData.bounceRateOk}
              isFridayPrayerTime={policyData.isFridayPrayerTime}
              isWeekend={policyData.isWeekend}
              warmupScore={policyData.warmupScore}
            />
          )}

          {/* Recommendations */}
          {policyData?.recommendations && Object.values(policyData.recommendations).some(Boolean) && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-sm text-amber-600 dark:text-amber-400">Recommendations for This Week</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {policyData.recommendations.needsGmailSeeds && (
                  <Link href="/settings" className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-full px-3 py-1 hover:bg-red-500/20 transition-colors">
                    Add Gmail seed accounts ({policyData.seedCounts.gmail}/{policyData.currentWeekConfig.gmail} needed)
                  </Link>
                )}
                {policyData.recommendations.needsOutlookSeeds && (
                  <Link href="/settings" className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full px-3 py-1 hover:bg-orange-500/20 transition-colors">
                    Add Outlook seed accounts ({policyData.seedCounts.outlook}/{policyData.currentWeekConfig.outlook} needed)
                  </Link>
                )}
                {policyData.recommendations.needsRealContacts && (
                  <Link href="/settings" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1 hover:bg-emerald-500/20 transition-colors">
                    Add real contacts ({policyData.seedCounts.real}/{policyData.currentWeekConfig.real} needed)
                  </Link>
                )}
                {policyData.recommendations.needsMoreInboxes && (
                  <Link href="/domains" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full px-3 py-1 hover:bg-blue-500/20 transition-colors">
                    Add more inboxes (need at least 3 for internal rotation)
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Domain Tabs + Inbox Cards */}
          <Tabs defaultValue={domainNames[0]} className="w-full">
            <TabsList className="mb-8 flex-wrap bg-muted/50 p-1.5 rounded-xl border border-border/50 shadow-sm">
              {domainNames.map(domain => (
                <TabsTrigger key={domain} value={domain} className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm font-medium transition-all">
                  <Globe className="w-4 h-4 mr-2 text-primary/70" /> {domain}
                  <Badge variant="secondary" className="ml-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs rounded-full px-2">{groupedInboxes[domain].length}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {domainNames.map(domain => (
              <TabsContent key={domain} value={domain} className="mt-0 outline-none">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-card to-muted/20 p-5 rounded-2xl border border-border shadow-sm">
                  <div className="mb-4 sm:mb-0">
                    <h3 className="text-xl font-bold text-foreground">Domain: {domain}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Detailed warmup statistics for all inboxes.</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => startWarmupForAll(domain)} variant="default" className="bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all rounded-full px-6 font-semibold">
                      <Flame className="w-4 h-4 mr-2" />Start All
                    </Button>
                    <Button onClick={() => bulkActionMutation.mutate('resume')} variant="outline" className="border-amber-200 text-amber-600 hover:bg-amber-50 rounded-full px-4 font-semibold">
                      <Play className="w-4 h-4 mr-2" />Resume All
                    </Button>
                    <Button onClick={() => bulkActionMutation.mutate('pause')} variant="outline" className="border-amber-200 text-amber-600 hover:bg-amber-50 rounded-full px-4 font-semibold">
                      <Pause className="w-4 h-4 mr-2" />Pause All
                    </Button>
                    <Button onClick={() => { if(confirm('Are you sure you want to stop and reset warmup for all inboxes?')) bulkActionMutation.mutate('stop'); }} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 rounded-full px-4 font-semibold">
                      <Square className="w-4 h-4 mr-2" />Stop All
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {groupedInboxes[domain].map((inbox: any) => {
                    const bounceRate = inbox.totalSent > 0 ? ((inbox.totalBounced / inbox.totalSent) * 100).toFixed(1) : '0.0';
                    const isHighBounce = parseFloat(bounceRate) > 5.0;
                    const weekConfig = WEEK_SCHEDULE[(Math.max(inbox.warmupWeek, 1) - 1)] || WEEK_SCHEDULE[0];
                    const isSelected = selectedInboxForPolicy === inbox.id;

                    return (
                      <Card key={inbox.id} className={cn("group overflow-hidden flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 relative bg-card cursor-pointer", isSelected ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60")} onClick={() => { setSelectedInboxForPolicy(inbox.id); queryClient.invalidateQueries({ queryKey: ['warmup-policy'] }); }}>
                        {/* Top Progress Bar */}
                        <div className="absolute top-0 inset-x-0 h-1.5 bg-muted overflow-hidden z-10">
                          <div className={`h-full transition-all duration-1000 ease-in-out ${inbox.warmupScore >= 80 ? 'bg-emerald-500' : inbox.warmupScore >= 40 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-red-500'}`} style={{ width: `${inbox.warmupScore}%` }} />
                        </div>

                        <CardHeader className="pb-3 pt-6">
                          <div className="flex justify-between items-start mb-3">
                            {getStatusBadge(inbox.warmupStatus)}
                            {inbox.warmupWeek > 0 && (
                              <Badge variant="outline" className="font-mono bg-background/50 backdrop-blur-sm border-primary/20 text-primary">Week {inbox.warmupWeek}/6</Badge>
                            )}
                          </div>
                          <CardTitle className="text-xl font-bold truncate tracking-tight text-foreground" title={inbox.emailAddress}>{inbox.emailAddress}</CardTitle>
                          {inbox.fromName && <p className="text-sm font-medium text-muted-foreground truncate">{inbox.fromName}</p>}
                          {/* Weekly Goal */}
                          {inbox.warmupWeek > 0 && (
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Target className="w-3.5 h-3.5 text-primary/60" />
                                <span className="text-xs text-primary/80 font-medium">{weekConfig.goal}</span>
                              </div>
                              <Badge variant="secondary" className="text-[10px] bg-muted/50">
                                Day {inbox.currentDay > 0 ? ((inbox.currentDay - 1) % 7) + 1 : 1}
                              </Badge>
                            </div>
                          )}
                        </CardHeader>

                        <CardContent className="pb-4 flex-1 space-y-3">
                          {/* Health Score + Daily Limit */}
                          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Health Score</p>
                              <div className="flex items-end gap-1">
                                <p className={`text-4xl font-extrabold tracking-tighter ${inbox.warmupScore >= 80 ? 'text-emerald-500' : inbox.warmupScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{inbox.warmupScore}</p>
                                <span className="text-sm text-muted-foreground mb-1.5 font-medium">/ {weekConfig.targetScore}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Daily Limit</p>
                              <p className="text-2xl font-bold text-foreground">{weekConfig.daily}</p>
                            </div>
                          </div>

                          {/* Recipient Split Bar */}
                          {inbox.warmupWeek > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Recipient Split</p>
                              <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                                {weekConfig.internal > 0 && <div className={cn(SPLIT_COLORS.internal.bg, "rounded-l-full")} style={{ flex: weekConfig.internal }} title={`Internal: ${weekConfig.internal}`} />}
                                {weekConfig.gmail > 0 && <div className={SPLIT_COLORS.gmail.bg} style={{ flex: weekConfig.gmail }} title={`Gmail: ${weekConfig.gmail}`} />}
                                {weekConfig.outlook > 0 && <div className={SPLIT_COLORS.outlook.bg} style={{ flex: weekConfig.outlook }} title={`Outlook: ${weekConfig.outlook}`} />}
                                {weekConfig.real > 0 && <div className={cn(SPLIT_COLORS.real.bg, "rounded-r-full")} style={{ flex: weekConfig.real }} title={`Real: ${weekConfig.real}`} />}
                              </div>
                              <div className="flex gap-2 mt-1">
                                {weekConfig.internal > 0 && <span className="text-[9px] text-blue-500 font-medium">{weekConfig.internal} int</span>}
                                {weekConfig.gmail > 0 && <span className="text-[9px] text-red-500 font-medium">{weekConfig.gmail} gmail</span>}
                                {weekConfig.outlook > 0 && <span className="text-[9px] text-orange-500 font-medium">{weekConfig.outlook} outlook</span>}
                                {weekConfig.real > 0 && <span className="text-[9px] text-emerald-500 font-medium">{weekConfig.real} real</span>}
                              </div>
                            </div>
                          )}

                          {/* Stats Grid */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-card border rounded-xl p-3 text-center transition-colors hover:bg-muted/30">
                              <Send className="w-4 h-4 mx-auto mb-2 text-blue-500 opacity-80" />
                              <p className="text-xl font-bold text-foreground">{inbox.totalSent}</p>
                              <p className="text-[9px] uppercase font-semibold text-muted-foreground mt-1">Sent</p>
                            </div>
                            <div className="bg-card border rounded-xl p-3 text-center transition-colors hover:bg-muted/30">
                              <Mail className="w-4 h-4 mx-auto mb-2 text-emerald-500 opacity-80" />
                              <p className="text-xl font-bold text-foreground">{inbox.totalReplied}</p>
                              <p className="text-[9px] uppercase font-semibold text-muted-foreground mt-1">Replied</p>
                            </div>
                            <div className={cn("border rounded-xl p-3 text-center transition-colors", isHighBounce ? "bg-red-500/10 border-red-500/30" : "bg-card hover:bg-muted/30")}>
                              <AlertTriangle className={cn("w-4 h-4 mx-auto mb-2 opacity-80", isHighBounce ? "text-red-500" : "text-amber-500")} />
                              <p className={cn("text-xl font-bold", isHighBounce ? "text-red-600 dark:text-red-400" : "text-foreground")}>{inbox.totalBounced}</p>
                              <p className="text-[9px] uppercase font-semibold text-muted-foreground mt-1">Bounced</p>
                            </div>
                            <div className="bg-card border rounded-xl p-3 text-center transition-colors hover:bg-muted/30">
                              <ShieldCheck className="w-4 h-4 mx-auto mb-2 text-purple-500 opacity-80" />
                              <p className="text-xl font-bold text-foreground">{inbox.totalSpam || 0}</p>
                              <p className="text-[9px] uppercase font-semibold text-muted-foreground mt-1">Spam</p>
                            </div>
                          </div>

                          {isHighBounce && (
                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                              <AlertTriangle className="w-4 h-4 shrink-0" />High bounce rate ({bounceRate}%) detected.
                            </div>
                          )}
                        </CardContent>

                        <CardFooter className="bg-muted/10 border-t p-4 flex flex-col gap-3">
                          {inbox.warmupStatus === 'paused' && inbox.warmupWeek > 0 && inbox.warmupWeek < 6 && (
                            <Button variant="default" className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md animate-pulse rounded-xl" onClick={(e) => { e.stopPropagation(); approveWeekMutation.mutate(inbox.id); }} disabled={approveWeekMutation.isPending}>
                              <CheckCircle className="w-4 h-4 mr-2" />Approve Week {inbox.warmupWeek + 1}
                            </Button>
                          )}
                          <div className="flex flex-wrap gap-2 w-full">
                            {inbox.warmupStatus === 'idle' && (
                              <Button variant="default" className="flex-1 font-semibold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" onClick={(e) => { e.stopPropagation(); toggleWarmupMutation.mutate({ id: inbox.id, action: 'start' }); }}>
                                <Play className="w-4 h-4 mr-1" /> Start
                              </Button>
                            )}
                            <Button variant="outline" className="flex-1 border-border/60 hover:bg-muted/50 rounded-xl" onClick={(e) => { e.stopPropagation(); setLogsInboxId(inbox.id); }}>
                              <Clock className="w-4 h-4 mr-1 text-muted-foreground" />Logs
                            </Button>
                            <Link href={`/inboxes/${inbox.id}`} className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0 border-border/60 hover:bg-muted/50 rounded-xl")} title="Details" onClick={(e) => e.stopPropagation()}>
                              <Activity className="w-4 h-4 text-muted-foreground" />
                            </Link>
                          </div>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}

      {/* Sent Emails Log Dialog */}
      <Dialog open={!!logsInboxId} onOpenChange={(open) => !open && setLogsInboxId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Sent Warmup Emails</DialogTitle>
            <DialogDescription>Recent emails sent by the warmup engine for this inbox.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto mt-4 rounded-md border">
            {logsLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading logs...</div>
            ) : warmupLogs?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No warmup emails sent yet.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date & Time</th>
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {warmupLogs?.map((log: any) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap">{format(new Date(log.date), 'MMM d, yyyy HH:mm:ss')}</td>
                      <td className="px-4 py-3 text-primary truncate max-w-[200px]">{log.recipientEmail || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        {log.status === 'replied' ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 capitalize">Replied</Badge>
                        ) : log.status === 'sent' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 capitalize">Sent</Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">{log.status}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

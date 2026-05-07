'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Play, Pause, Flame, CheckCircle, Globe, Activity, Mail, AlertTriangle, Send } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function WarmupPage() {
  const queryClient = useQueryClient();

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

  const toggleWarmupMutation = useMutation({
    mutationFn: ({ id, action }: { id: string, action: 'start' | 'pause' }) => 
      fetchApi(`/inboxes/${id}/${action}-warmup`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboxes'] });
      toast.success('Warmup status updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startWarmupMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/inboxes/${id}/start-warmup`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboxes'] });
      toast.success('Warmup started');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const approveWeekMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/inboxes/${id}/approve-week`, { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['inboxes'] });
      toast.success(data.message || 'Week approved!');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startWarmupForAll = (domain: string) => {
    const inboxesToWarmup = groupedInboxes[domain]?.filter((i: any) => i.warmupStatus !== 'warming' && i.warmupStatus !== 'ready') || [];
    if (inboxesToWarmup.length === 0) {
      toast.info('All inboxes are already warming up or ready.');
      return;
    }
    inboxesToWarmup.forEach((inbox: any) => {
      startWarmupMutation.mutate(inbox.id);
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready': 
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent"><CheckCircle className="w-3 h-3 mr-1" /> Ready</Badge>;
      case 'warming': 
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white animate-pulse border-transparent shadow-md font-bold px-3">
            <Flame className="w-3.5 h-3.5 mr-1" /> Warming
          </Badge>
        );
      case 'paused': 
        return <Badge variant="outline" className="opacity-70"><Pause className="w-3 h-3 mr-1" /> Paused</Badge>;
      default: 
        return <Badge variant="outline" className="opacity-70">Idle</Badge>;
    }
  };

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
        <div className="flex justify-center p-12">
          <Activity className="w-8 h-8 animate-spin text-primary opacity-50" />
        </div>
      ) : domainNames.length === 0 ? (
        <Card className="p-16 text-center flex flex-col items-center justify-center border-dashed bg-card/50">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <Flame className="w-10 h-10 text-muted-foreground opacity-40" />
          </div>
          <h3 className="text-2xl font-bold mb-2">No Warmup Data Found</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-8 text-lg">Add domains and create inboxes to start warming them up and monitor their deliverability health here.</p>
          <Button render={<Link href="/domains" />} size="lg" className="rounded-full px-8 shadow-md">
            Go to Domains
          </Button>
        </Card>
      ) : (
        <Tabs defaultValue={domainNames[0]} className="w-full">
          <TabsList className="mb-8 flex-wrap bg-muted/50 p-1.5 rounded-xl border border-border/50 shadow-sm">
            {domainNames.map(domain => (
              <TabsTrigger 
                key={domain} 
                value={domain}
                className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2 text-sm font-medium transition-all"
              >
                <Globe className="w-4 h-4 mr-2 text-primary/70" /> 
                {domain}
                <Badge variant="secondary" className="ml-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs rounded-full px-2">
                  {groupedInboxes[domain].length}
                </Badge>
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
                <Button 
                  onClick={() => startWarmupForAll(domain)} 
                  variant="default" 
                  className="bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all rounded-full px-6 font-semibold"
                >
                  <Flame className="w-4 h-4 mr-2" />
                  Start Warmup for All
                </Button>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {groupedInboxes[domain].map((inbox: any) => {
                  const bounceRate = inbox.totalSent > 0 ? ((inbox.totalBounced / inbox.totalSent) * 100).toFixed(1) : '0.0';
                  const isHighBounce = parseFloat(bounceRate) > 5.0;
                  
                  return (
                    <Card key={inbox.id} className="group overflow-hidden flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 relative bg-card border-border/60">
                      {/* Top Progress Bar */}
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-muted overflow-hidden z-10">
                        <div 
                          className={`h-full transition-all duration-1000 ease-in-out ${inbox.warmupScore >= 80 ? 'bg-emerald-500' : inbox.warmupScore >= 40 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-red-500'}`} 
                          style={{ width: `${inbox.warmupScore}%` }} 
                        />
                      </div>
                      
                      <CardHeader className="pb-4 pt-6">
                        <div className="flex justify-between items-start mb-3">
                          {getStatusBadge(inbox.warmupStatus)}
                          {inbox.warmupWeek > 0 && (
                            <Badge variant="outline" className="font-mono bg-background/50 backdrop-blur-sm border-primary/20 text-primary">
                              Week {inbox.warmupWeek}/6
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-bold truncate tracking-tight text-foreground" title={inbox.emailAddress}>
                            {inbox.emailAddress}
                          </CardTitle>
                          {inbox.fromName && (
                            <p className="text-sm font-medium text-muted-foreground truncate">{inbox.fromName}</p>
                          )}
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pb-4 flex-1 space-y-4">
                        {/* Health Score Component */}
                        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Health Score</p>
                            <div className="flex items-end gap-1">
                              <p className={`text-4xl font-extrabold tracking-tighter ${inbox.warmupScore >= 80 ? 'text-emerald-500' : inbox.warmupScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                                {inbox.warmupScore}
                              </p>
                              <span className="text-sm text-muted-foreground mb-1.5 font-medium">/ 100</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Daily Limit</p>
                            <p className="text-2xl font-bold text-foreground">{inbox.dailySendLimit}</p>
                          </div>
                        </div>
                        
                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-card border rounded-xl p-3 text-center transition-colors hover:bg-muted/30">
                            <Send className="w-4 h-4 mx-auto mb-2 text-blue-500 opacity-80" />
                            <p className="text-xl font-bold text-foreground">{inbox.totalSent}</p>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-1">Sent</p>
                          </div>
                          <div className="bg-card border rounded-xl p-3 text-center transition-colors hover:bg-muted/30">
                            <Mail className="w-4 h-4 mx-auto mb-2 text-emerald-500 opacity-80" />
                            <p className="text-xl font-bold text-foreground">{inbox.totalReplied}</p>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-1">Replied</p>
                          </div>
                          <div className={cn("border rounded-xl p-3 text-center transition-colors", isHighBounce ? "bg-red-500/10 border-red-500/30" : "bg-card hover:bg-muted/30")}>
                            <AlertTriangle className={cn("w-4 h-4 mx-auto mb-2 opacity-80", isHighBounce ? "text-red-500" : "text-amber-500")} />
                            <p className={cn("text-xl font-bold", isHighBounce ? "text-red-600 dark:text-red-400" : "text-foreground")}>{inbox.totalBounced}</p>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-1">Bounced</p>
                          </div>
                        </div>

                        {/* Bounce Rate Warning */}
                        {isHighBounce && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            High bounce rate ({bounceRate}%) detected.
                          </div>
                        )}
                      </CardContent>
                      
                      <CardFooter className="bg-muted/10 border-t p-4 flex flex-col gap-3">
                        {/* Approve Next Week Banner */}
                        {inbox.warmupStatus === 'paused' && inbox.warmupWeek > 0 && inbox.warmupWeek < 6 && (
                          <Button 
                            variant="default"
                            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md animate-pulse rounded-xl"
                            onClick={() => approveWeekMutation.mutate(inbox.id)}
                            disabled={approveWeekMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve Week {inbox.warmupWeek + 1}
                          </Button>
                        )}
                        
                        <div className="flex flex-wrap gap-3 w-full">
                          {inbox.warmupStatus === 'warming' ? (
                            <Button variant="secondary" className="flex-1 font-semibold border-amber-200/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 rounded-xl" onClick={() => toggleWarmupMutation.mutate({ id: inbox.id, action: 'pause' })}>
                              <Pause className="w-4 h-4 mr-2" /> Pause
                            </Button>
                          ) : (
                            <Button variant="default" className="flex-1 font-semibold shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" onClick={() => toggleWarmupMutation.mutate({ id: inbox.id, action: 'start' })}>
                              <Play className="w-4 h-4 mr-2" /> Start 
                            </Button>
                          )}
                          
                          <Button render={<Link href={`/inboxes/${inbox.id}`} />} variant="outline" className="flex-1 border-border/60 hover:bg-muted/50 rounded-xl">
                            <Activity className="w-4 h-4 mr-2 text-muted-foreground" />
                            Details
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, RotateCw, ChevronDown, ChevronUp, LayoutGrid, Bug, Ban } from 'lucide-react';

export default function DeliverabilityPage() {
  const queryClient = useQueryClient();
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const { data: checks, isLoading } = useQuery({
    queryKey: ['deliverability'],
    queryFn: () => fetchApi('/deliverability'),
  });

  const runCheckMutation = useMutation({
    mutationFn: (inboxId: string) => fetchApi(`/deliverability/${inboxId}/run-check`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverability'] });
      toast.success('Health check completed');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleNotes = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group checks by inbox
  const grouped = (checks || []).reduce((acc: any, check: any) => {
    const key = check.inbox?.emailAddress || check.inboxId;
    if (!acc[key]) acc[key] = { inbox: check.inbox, checks: [] };
    acc[key].checks.push(check);
    return acc;
  }, {});

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Passed</Badge>;
      case 'action_needed':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20"><AlertTriangle className="w-3 h-3 mr-1" /> Action Needed</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getSpamColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 8) return 'text-emerald-500';
    if (score >= 7) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Deliverability</h2>
        <p className="text-muted-foreground">Monitor inbox health, spam scores, and blacklist status.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutGrid className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="spam">
            <Bug className="w-4 h-4" /> Spam Placement
          </TabsTrigger>
          <TabsTrigger value="blacklist">
            <Ban className="w-4 h-4" /> Blacklist Monitor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {isLoading ? (
            <p>Loading health checks...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4 mx-auto opacity-20" />
              <h3 className="text-xl font-bold">No health checks yet</h3>
              <p className="text-muted-foreground">Health checks run automatically every Monday. Start warming up inboxes to see results.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([email, data]: [string, any]) => (
                <Card key={email} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 border-b">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-lg">{email}</CardTitle>
                        <CardDescription>{data.inbox?.domain?.domainName} • Week {data.inbox?.warmupWeek || '?'}/6</CardDescription>
                      </div>
                      <Button 
                        variant="outline" size="sm"
                        onClick={() => runCheckMutation.mutate(data.checks[0]?.inboxId)}
                        disabled={runCheckMutation.isPending}
                      >
                        <RotateCw className={`w-4 h-4 mr-2 ${runCheckMutation.isPending ? 'animate-spin' : ''}`} />
                        Run Check Now
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {data.checks.slice(0, 4).map((check: any) => (
                        <div key={check.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              {getStatusBadge(check.status)}
                              <span className="text-sm text-muted-foreground">
                                Week {check.week} • {new Date(check.date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-5 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase">Spam Score</p>
                              <p className={`text-2xl font-bold ${getSpamColor(check.spamScore)}`}>
                                {check.spamScore?.toFixed(1) || '—'}<span className="text-sm text-muted-foreground font-normal">/10</span>
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase">Blacklist</p>
                              <p className={`text-2xl font-bold ${check.blacklisted ? 'text-red-500' : 'text-emerald-500'}`}>
                                {check.blacklisted ? '⚠️' : '✅'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase">Bounce Rate</p>
                              <p className={`text-2xl font-bold ${(check.bounceRate || 0) > 5 ? 'text-red-500' : (check.bounceRate || 0) > 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {check.bounceRate?.toFixed(1) || '0'}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase">Reply Rate</p>
                              <p className={`text-2xl font-bold ${(check.replyRate || 0) < 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {check.replyRate?.toFixed(1) || '0'}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase">Warmup Score</p>
                              <p className={`text-2xl font-bold ${(check.warmupScore || 0) >= 80 ? 'text-emerald-500' : (check.warmupScore || 0) >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                                {check.warmupScore || 0}
                              </p>
                            </div>
                          </div>
                          {check.notes && check.notes !== 'All checks passed ✅' && (
                            <div className="mt-3">
                              <button 
                                onClick={() => toggleNotes(check.id)}
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                              >
                                {expandedNotes[check.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {expandedNotes[check.id] ? 'Hide details' : 'View recommendations'}
                              </button>
                              {expandedNotes[check.id] && (
                                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                                  <pre className="text-sm whitespace-pre-wrap font-sans text-amber-800 dark:text-amber-200">{check.notes}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="spam">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Spam Placement Tests</CardTitle>
              <CardDescription>Weekly spam score results from mail-tester. Scores of 8+/10 are ideal.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <p>Loading...</p> : (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([email, data]: [string, any]) => {
                    const latestCheck = data.checks[0];
                    const score = latestCheck?.spamScore;
                    return (
                      <div key={email} className="border rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold">{email}</h4>
                          <p className="text-sm text-muted-foreground">{data.inbox?.domain?.domainName}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`text-3xl font-bold ${getSpamColor(score)}`}>{score?.toFixed(1) || '—'}</p>
                            <p className="text-xs text-muted-foreground">/10</p>
                          </div>
                          {score && score < 7 && (
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-red-500/10 text-red-600 border-red-200">Needs Fixing</Badge>
                              <button 
                                onClick={() => toggleNotes(latestCheck.id)}
                                className="text-xs text-primary hover:underline"
                              >
                                View Guide
                              </button>
                            </div>
                          )}
                          {score && score >= 8 && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Excellent</Badge>
                          )}
                          {score && score >= 7 && score < 8 && (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Good</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blacklist">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Blacklist Monitor</CardTitle>
              <CardDescription>Domain blacklist status checked via MXToolbox. All should be clean.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <p>Loading...</p> : (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([email, data]: [string, any]) => {
                    const latestCheck = data.checks[0];
                    const listed = latestCheck?.blacklisted;
                    return (
                      <div key={email} className="border rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold">{email}</h4>
                          <p className="text-sm text-muted-foreground">{data.inbox?.domain?.domainName}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {listed ? (
                            <>
                              <Badge className="bg-red-500/10 text-red-600 border-red-200">
                                <XCircle className="w-3 h-3 mr-1" /> Listed
                              </Badge>
                              <button 
                                onClick={() => toggleNotes(latestCheck.id)}
                                className="text-sm text-primary hover:underline"
                              >
                                View Removal Guide
                              </button>
                            </>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Clean
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

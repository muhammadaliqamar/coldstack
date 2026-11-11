'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RotateCw, 
  ChevronDown, 
  ChevronUp, 
  LayoutGrid, 
  Bug, 
  Ban,
  Globe,
  FileText,
  HelpCircle,
  TrendingUp,
  Sparkles
} from 'lucide-react';

export default function DeliverabilityPage() {
  const queryClient = useQueryClient();
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  
  // DNS Checker states
  const [dnsDomain, setDnsDomain] = useState('');
  const [dnsResults, setDnsResults] = useState<any>(null);
  const [checkingDns, setCheckingDns] = useState(false);

  // Content Analyzer states
  const [analyzerSubject, setAnalyzerSubject] = useState('');
  const [analyzerBody, setAnalyzerBody] = useState('');
  const [analyzerResults, setAnalyzerResults] = useState<any>(null);
  const [analyzingContent, setAnalyzingContent] = useState(false);

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

  const handleDnsCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dnsDomain) {
      toast.warning('Please enter a domain name');
      return;
    }
    setCheckingDns(true);
    setDnsResults(null);
    try {
      const res = await fetchApi('/deliverability/check-dns', {
        method: 'POST',
        body: JSON.stringify({ domain: dnsDomain }),
      });
      setDnsResults(res);
      toast.success('DNS checks completed successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to check DNS records');
    } finally {
      setCheckingDns(false);
    }
  };

  const handleContentAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analyzerBody) {
      toast.warning('Please enter email body content');
      return;
    }
    setAnalyzingContent(true);
    setAnalyzerResults(null);
    try {
      const res = await fetchApi('/deliverability/analyze-content', {
        method: 'POST',
        body: JSON.stringify({ subject: analyzerSubject, body: analyzerBody }),
      });
      setAnalyzerResults(res);
      toast.success('Content spam score computed!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to analyze content');
    } finally {
      setAnalyzingContent(false);
    }
  };

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

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'A':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/25">Grade A (High Deliverability)</span>;
      case 'B':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/25">Grade B (Minor Issues)</span>;
      case 'C':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/25">Grade C (Risky Spam filters)</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 border border-red-500/25">Grade D (Highly Spammy)</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Deliverability Suite
        </h2>
        <p className="text-muted-foreground mt-2">
          Monitor inbox authentication, spam placements, DNS settings, and analyze email copy reputations.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 rounded-lg border border-border/50 shadow-sm w-full md:w-auto overflow-x-auto whitespace-nowrap flex md:inline-flex">
          <TabsTrigger value="overview" className="flex items-center gap-2 px-4 py-2 font-semibold">
            <LayoutGrid className="w-4 h-4" /> Inbox Health Overview
          </TabsTrigger>
          <TabsTrigger value="dns-check" className="flex items-center gap-2 px-4 py-2 font-semibold">
            <Globe className="w-4 h-4" /> DNS Setup Checker
          </TabsTrigger>
          <TabsTrigger value="analyzer" className="flex items-center gap-2 px-4 py-2 font-semibold">
            <FileText className="w-4 h-4" /> Spam Content Analyzer
          </TabsTrigger>
          <TabsTrigger value="spam" className="flex items-center gap-2 px-4 py-2 font-semibold">
            <Bug className="w-4 h-4" /> Simulated Seeds Placement
          </TabsTrigger>
          <TabsTrigger value="blacklist" className="flex items-center gap-2 px-4 py-2 font-semibold">
            <Ban className="w-4 h-4" /> Blacklist Monitor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {isLoading ? (
            <p className="text-muted-foreground animate-pulse text-sm">Loading health checks...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <Card className="p-12 text-center border-dashed rounded-2xl bg-card border-border/60">
              <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4 mx-auto opacity-20" />
              <h3 className="text-xl font-bold">No deliverability checks yet</h3>
              <p className="text-muted-foreground mt-1">Health checks run automatically every Monday. Start warming up inboxes to see results.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([email, data]: [string, any]) => (
                <Card key={email} className="overflow-hidden border border-border/50 shadow-sm rounded-2xl bg-card">
                  <CardHeader className="bg-muted/30 border-b border-border/40 py-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <CardTitle className="text-lg font-bold">{email}</CardTitle>
                        <CardDescription className="text-xs font-medium text-muted-foreground">
                          {data.inbox?.domain?.domainName} • Current Warmup Week {data.inbox?.warmupWeek || '?'}/6
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" size="sm"
                        className="rounded-xl shadow-sm border border-border/60 hover:bg-muted font-semibold text-xs animate-none transition-all"
                        onClick={() => runCheckMutation.mutate(data.checks[0]?.inboxId)}
                        disabled={runCheckMutation.isPending}
                      >
                        <RotateCw className={`w-3.5 h-3.5 mr-2 ${runCheckMutation.isPending ? 'animate-spin' : ''}`} />
                        Run Check Now
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {data.checks.slice(0, 4).map((check: any) => (
                        <div key={check.id} className="border border-border/50 rounded-xl p-5 bg-card hover:shadow-sm transition-all duration-300">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              {getStatusBadge(check.status)}
                              <span className="text-xs text-muted-foreground font-semibold">
                                Week {check.week} • Checked {new Date(check.date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Placement Score</p>
                              <p className={`text-2xl font-black ${getSpamColor(check.spamScore)}`}>
                                {check.spamScore?.toFixed(1) || '—'}<span className="text-xs text-muted-foreground font-normal">/10</span>
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Blacklist Status</p>
                              <p className={`text-2xl font-black ${check.blacklisted ? 'text-red-500' : 'text-emerald-500'}`}>
                                {check.blacklisted ? '⚠️ Blocked' : '✅ Clean'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bounce Rate</p>
                              <p className={`text-2xl font-black ${(check.bounceRate || 0) > 5 ? 'text-red-500' : (check.bounceRate || 0) > 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {check.bounceRate?.toFixed(1) || '0.0'}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Warmup Response</p>
                              <p className={`text-2xl font-black ${(check.replyRate || 0) < 20 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {check.replyRate?.toFixed(1) || '0.0'}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sender Score</p>
                              <p className={`text-2xl font-black ${(check.warmupScore || 0) >= 80 ? 'text-emerald-500' : (check.warmupScore || 0) >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                                {check.warmupScore || 0}<span className="text-xs text-muted-foreground font-normal">/100</span>
                              </p>
                            </div>
                          </div>
                          {check.notes && check.notes !== 'All checks passed ✅' && (
                            <div className="mt-4 border-t border-border/40 pt-4">
                              <button 
                                onClick={() => toggleNotes(check.id)}
                                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                {expandedNotes[check.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {expandedNotes[check.id] ? 'Hide recommendations' : 'View deliverability fixes'}
                              </button>
                              {expandedNotes[check.id] && (
                                <div className="mt-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                  <pre className="text-xs whitespace-pre-wrap font-sans text-amber-700 dark:text-amber-300 leading-relaxed font-semibold">{check.notes}</pre>
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

        <TabsContent value="dns-check">
          <div className="grid gap-8 md:grid-cols-3">
            <Card className="md:col-span-1 border border-border/50 shadow-sm rounded-2xl bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Live DNS Lookup
                </CardTitle>
                <CardDescription>
                  Enter domain to verify live SPF, DKIM selector, and DMARC text-records.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleDnsCheck}>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="domain" className="text-sm font-semibold">Domain Name</Label>
                    <Input
                      id="domain"
                      placeholder="e.g. yourcompany.com"
                      className="rounded-xl border border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
                      value={dnsDomain}
                      onChange={(e) => setDnsDomain(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all cursor-pointer"
                    disabled={checkingDns}
                  >
                    {checkingDns ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Resolving DNS...
                      </>
                    ) : 'Lookup DNS Auth Records'}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <div className="md:col-span-2 space-y-6">
              {!dnsResults ? (
                <Card className="border border-dashed border-border/60 rounded-2xl h-full flex flex-col justify-center items-center p-12 text-center text-muted-foreground bg-card min-h-[300px]">
                  <Globe className="w-12 h-12 opacity-15 mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium">No domain searched yet. Enter domain in the card side to fetch live records.</p>
                </Card>
              ) : (
                <div className="space-y-6">
                  <Card className="border border-border/50 shadow-sm rounded-2xl bg-card">
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        DNS Security Report for {dnsResults.domain}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      {/* SPF Check Card */}
                      <div className="p-5 border border-border/40 rounded-xl flex items-start gap-4">
                        <div className="mt-1">
                          {dnsResults.spf.status === 'valid' ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm border border-emerald-500/25">✓</div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm border border-red-500/25">✗</div>
                          )}
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm">SPF Authentication</span>
                            <Badge variant={dnsResults.spf.status === 'valid' ? 'default' : 'destructive'} className="rounded-full text-[10px] px-2">
                              {dnsResults.spf.status === 'valid' ? 'Passed' : 'Missing record'}
                            </Badge>
                          </div>
                          {dnsResults.spf.status === 'valid' ? (
                            <p className="text-xs bg-muted/50 p-2.5 rounded-lg border border-border/30 font-mono text-muted-foreground break-all">
                              {dnsResults.spf.record}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Add a TXT record to authorize your outbound mail servers: <code className="bg-muted px-1.5 py-0.5 rounded text-primary">v=spf1 include:mailgun.org ~all</code>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* DKIM Check Card */}
                      <div className="p-5 border border-border/40 rounded-xl flex items-start gap-4">
                        <div className="mt-1">
                          {dnsResults.dkim.status === 'valid' ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm border border-emerald-500/25">✓</div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm border border-red-500/25">✗</div>
                          )}
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm">DKIM Key Verification</span>
                            <Badge variant={dnsResults.dkim.status === 'valid' ? 'default' : 'destructive'} className="rounded-full text-[10px] px-2">
                              {dnsResults.dkim.status === 'valid' ? 'Verified' : 'Selector missing'}
                            </Badge>
                          </div>
                          {dnsResults.dkim.status === 'valid' ? (
                            <p className="text-xs bg-muted/50 p-2.5 rounded-lg border border-border/30 font-mono text-muted-foreground break-all">
                              {dnsResults.dkim.record}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Unable to automatically resolve the public key using selectors <code className="bg-muted px-1.5 py-0.5 rounded text-primary">default</code> or <code className="bg-muted px-1.5 py-0.5 rounded text-primary">google</code>. Verify your setup in your SMTP provider.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* DMARC Check Card */}
                      <div className="p-5 border border-border/40 rounded-xl flex items-start gap-4">
                        <div className="mt-1">
                          {dnsResults.dmarc.status === 'valid' ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm border border-emerald-500/25">✓</div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm border border-amber-500/25">!</div>
                          )}
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sm">DMARC Domain Alignment Policy</span>
                            <Badge variant={dnsResults.dmarc.status === 'valid' ? 'default' : 'outline'} className={`rounded-full text-[10px] px-2 ${dnsResults.dmarc.status !== 'valid' ? 'text-amber-600 border-amber-300 hover:bg-transparent' : ''}`}>
                              {dnsResults.dmarc.status === 'valid' ? 'Passed' : 'Not configured'}
                            </Badge>
                          </div>
                          {dnsResults.dmarc.status === 'valid' ? (
                            <p className="text-xs bg-muted/50 p-2.5 rounded-lg border border-border/30 font-mono text-muted-foreground break-all">
                              {dnsResults.dmarc.record}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Protect your domain against spoofing! Create a TXT record at <code className="bg-muted px-1.5 py-0.5 rounded text-primary">_dmarc.{dnsDomain}</code> with value: <code className="bg-muted px-1.5 py-0.5 rounded text-primary">v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com</code>
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analyzer">
          <div className="grid gap-8 md:grid-cols-5">
            <Card className="md:col-span-2 border border-border/50 shadow-sm rounded-2xl bg-card">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Spam Copy Check
                </CardTitle>
                <CardDescription>
                  Paste your email subject and body content. We will calculate a 0-100 spam compliance score with actionable fixes.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleContentAnalyze}>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="analyzerSubject" className="text-sm font-semibold">Email Subject Line</Label>
                    <Input
                      id="analyzerSubject"
                      placeholder="e.g. Free exclusive offer just for you!!!"
                      className="rounded-xl border border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
                      value={analyzerSubject}
                      onChange={(e) => setAnalyzerSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="analyzerBody" className="text-sm font-semibold">Email Body HTML or Text</Label>
                    <Textarea
                      id="analyzerBody"
                      placeholder="Paste your content here..."
                      className="min-h-[220px] rounded-xl border border-border/70 text-sm leading-relaxed focus-visible:ring-1 focus-visible:ring-primary"
                      value={analyzerBody}
                      onChange={(e) => setAnalyzerBody(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all cursor-pointer"
                    disabled={analyzingContent}
                  >
                    {analyzingContent ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        Scanning Copy...
                      </>
                    ) : 'Analyze Copy Reputation'}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            <div className="md:col-span-3 space-y-6">
              {!analyzerResults ? (
                <Card className="border border-dashed border-border/60 rounded-2xl h-full flex flex-col justify-center items-center p-12 text-center text-muted-foreground bg-card min-h-[300px]">
                  <FileText className="w-12 h-12 opacity-15 mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium">No content evaluated. Paste your copy on the left pane and hit analyze.</p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Score Header Card */}
                  <Card className="border border-border/50 shadow-sm rounded-2xl bg-card">
                    <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
                      <div>
                        <CardTitle className="text-xl font-black">Content Compliance Report</CardTitle>
                        <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">Checked against 20 semantic and compliance checks.</CardDescription>
                      </div>
                      <div>
                        {getGradeBadge(analyzerResults.grade)}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 flex items-center justify-between gap-6">
                      <div className="space-y-2 flex-1">
                        <div className="flex justify-between items-center text-sm font-bold">
                          <span>Outbound Reputation Score</span>
                          <span className={`font-black ${analyzerResults.score >= 90 ? 'text-emerald-500' : analyzerResults.score >= 75 ? 'text-blue-500' : analyzerResults.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                            {analyzerResults.score}/100
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden border">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              analyzerResults.score >= 90 ? 'bg-emerald-500' : analyzerResults.score >= 75 ? 'bg-blue-500' : analyzerResults.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${analyzerResults.score}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rules Breakdown Checklist */}
                  <Card className="border border-border/50 shadow-sm rounded-2xl bg-card">
                    <CardHeader className="border-b pb-3">
                      <CardTitle className="text-sm font-bold text-foreground">Rule Breakdown & Suggestions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      {analyzerResults.breakDown.map((rule: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 p-4 border border-border/30 rounded-xl bg-muted/10 hover:shadow-xs transition-all duration-200">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                            rule.passed 
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' 
                              : rule.score === 0 
                                ? 'bg-muted text-muted-foreground border-border/40' 
                                : 'bg-red-500/10 text-red-600 border-red-500/25'
                          }`}>
                            {rule.passed ? '✓' : '✗'}
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">{rule.name}</span>
                              {rule.score !== 0 && (
                                <span className={`text-[10px] font-black rounded px-1.5 border ${
                                  rule.score < 0 
                                    ? 'bg-red-500/10 text-red-600 border-red-500/20' 
                                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                }`}>
                                  {rule.score > 0 ? `+${rule.score}` : rule.score} pts
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed font-semibold">{rule.tip}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="spam">
          <Card className="border border-border/50 shadow-sm rounded-2xl bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-bold text-xl text-foreground">
                <Bug className="w-5 h-5 text-primary" />
                Seed Inboxes Placement Tests
              </CardTitle>
              <CardDescription className="text-sm">
                Real-time delivery simulations verifying if standard warming campaigns hit inbox or promotions tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading placement data...</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(grouped).map(([email, data]: [string, any]) => {
                    const latestCheck = data.checks[0];
                    const score = latestCheck?.spamScore;
                    return (
                      <div key={email} className="border border-border/50 rounded-xl p-5 flex flex-col justify-between hover:shadow-sm transition-all duration-300 bg-card">
                        <div>
                          <h4 className="font-bold text-sm text-foreground break-all">{email}</h4>
                          <p className="text-xs font-semibold text-muted-foreground mt-0.5">{data.inbox?.domain?.domainName}</p>
                        </div>
                        <div className="flex justify-between items-center mt-6">
                          <div className="text-left">
                            <p className={`text-2xl font-black ${getSpamColor(score)}`}>{score?.toFixed(1) || '—'}<span className="text-[10px] text-muted-foreground font-normal">/10</span></p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Spam rating</p>
                          </div>
                          {score && score < 7 ? (
                            <Badge className="bg-red-500/10 text-red-600 border-red-200 text-[10px] font-bold">Inbox Blocked</Badge>
                          ) : score && score >= 8 ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] font-bold">100% Primary Inbox</Badge>
                          ) : (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px] font-bold">Promotions Tab</Badge>
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
          <Card className="border border-border/50 shadow-sm rounded-2xl bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-bold text-xl text-foreground">
                <Ban className="w-5 h-5 text-primary" />
                Blacklist Verification Center
              </CardTitle>
              <CardDescription className="text-sm">
                Continuous background scanning verifying if domain or IP are listed in high-risk DNSBL blocklists.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {isLoading ? (
                <p className="text-muted-foreground text-sm">Loading blacklist results...</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([email, data]: [string, any]) => {
                    const latestCheck = data.checks[0];
                    const listed = latestCheck?.blacklisted;
                    return (
                      <div key={email} className="border border-border/50 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{email}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{data.inbox?.domain?.domainName}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {listed ? (
                            <>
                              <Badge className="bg-red-500/10 text-red-600 border-red-200 text-[10px] font-bold">
                                Listed on Spamhaus / Barracuda
                              </Badge>
                              <Button 
                                variant="outline" size="sm"
                                className="text-xs rounded-xl shadow-sm hover:bg-muted font-bold"
                                onClick={() => toggleNotes(latestCheck.id)}
                              >
                                View Removal Guide
                              </Button>
                            </>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] font-bold">
                              Passed (0 Blacklists Flagged)
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

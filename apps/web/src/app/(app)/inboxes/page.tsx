'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Play, Pause, Flame, Settings, Activity, CheckCircle, Globe, Trash2, Send, Mail } from 'lucide-react';
import Link from 'next/link';

export default function InboxesPage() {
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedInbox, setSelectedInbox] = useState<any>(null);
  const [formData, setFormData] = useState({
    emailAddress: '',
    fromName: '',
    dailySendLimit: 5,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    imapHost: '',
    imapPort: 993,
    imapUser: '',
    imapPass: ''
  });

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testInbox, setTestInbox] = useState<any>(null);

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => fetchApi('/templates'),
  });

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

  const updateInboxMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => 
      fetchApi(`/inboxes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboxes'] });
      setIsSettingsOpen(false);
      toast.success('Inbox settings updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteInboxMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/inboxes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboxes'] });
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Inbox deleted successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sendTestMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => 
      fetchApi(`/inboxes/${id}/send-test`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      setIsTestModalOpen(false);
      toast.success('Test email sent successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSendTest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    sendTestMutation.mutate({
      id: testInbox.id,
      data: {
        toEmail: formData.get('toEmail'),
        templateId: formData.get('templateId'),
      }
    });
  };

  const openTestModal = (inbox: any) => {
    setTestInbox(inbox);
    setIsTestModalOpen(true);
  };

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

  const openSettings = (inbox: any) => {
    setSelectedInbox(inbox);
    setFormData({
      emailAddress: inbox.emailAddress || '',
      fromName: inbox.fromName || '',
      dailySendLimit: inbox.dailySendLimit || 5,
      smtpHost: inbox.smtpHost || '',
      smtpPort: inbox.smtpPort || 587,
      smtpUser: inbox.smtpUser || '',
      smtpPass: '', // keep empty so we don't overwrite with '***'
      imapHost: inbox.imapHost || '',
      imapPort: inbox.imapPort || 993,
      imapUser: inbox.imapUser || '',
      imapPass: ''
    });
    setIsSettingsOpen(true);
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInbox) return;
    
    // Clean up empty password if it hasn't changed
    const submitData = { 
      ...formData, 
      dailySendLimit: Number(formData.dailySendLimit), 
      smtpPort: Number(formData.smtpPort),
      imapPort: Number(formData.imapPort)
    };
    if (!submitData.smtpPass) {
      delete (submitData as any).smtpPass;
    }
    if (!submitData.imapPass) {
      delete (submitData as any).imapPass;
    }

    updateInboxMutation.mutate({ id: selectedInbox.id, data: submitData });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Inboxes & Warmup</h2>
        <p className="text-muted-foreground">Monitor inbox health and manage automated warmup.</p>
      </div>

      {isLoading ? (
        <div>Loading inboxes...</div>
      ) : inboxes?.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center border-dashed">
          <Flame className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-xl font-bold">No inboxes found</h3>
          <p className="text-muted-foreground mb-6">Add a domain to automatically generate your outreach inboxes.</p>
        </Card>
      ) : (
        <Tabs defaultValue={domainNames[0]} className="w-full">
          <TabsList className="mb-6 flex-wrap">
            {domainNames.map(domain => (
              <TabsTrigger key={domain} value={domain}>
                <Globe className="w-4 h-4 opacity-70" /> 
                {domain}
                <Badge variant="secondary" className="ml-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs">{groupedInboxes[domain].length}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {domainNames.map(domain => (
            <TabsContent key={domain} value={domain} className="mt-0 outline-none">
              <div className="mb-6 flex justify-between items-center bg-muted/20 p-4 rounded-xl border border-border/50">
                <div>
                  <h3 className="text-lg font-medium">Domain Inboxes</h3>
                  <p className="text-sm text-muted-foreground">Manage the active inboxes for this domain.</p>
                </div>
                <Button 
                  onClick={() => startWarmupForAll(domain)} 
                  variant="default" 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
                >
                  <Flame className="w-4 h-4 mr-2" />
                  Start Warmup for All
                </Button>
              </div>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {groupedInboxes[domain].map((inbox: any) => (
                  <Card key={inbox.id} className="group overflow-hidden flex flex-col transition-all hover:shadow-lg hover:border-primary/20 relative bg-background/60 backdrop-blur-sm">
                    <div className="absolute top-0 inset-x-0 h-1 bg-muted overflow-hidden z-10">
                      <div 
                        className={`h-full transition-all duration-1000 ease-in-out ${inbox.warmupScore >= 80 ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-amber-600'}`} 
                        style={{ width: `${inbox.warmupScore}%` }} 
                      />
                    </div>
                    
                    <CardHeader className="pb-4 pt-6">
                      <div className="space-y-3">
                        <div className="space-y-1.5 min-w-0">
                          <CardTitle className="text-xl font-bold truncate tracking-tight" title={inbox.emailAddress}>{inbox.emailAddress}</CardTitle>
                          {inbox.fromName && (
                            <p className="text-sm font-medium text-primary/80 truncate">{inbox.fromName}</p>
                          )}
                          <CardDescription className="flex items-center text-sm truncate" title={inbox.domainName}>
                            <Globe className="w-3.5 h-3.5 mr-1.5 opacity-70 shrink-0" /> <span className="truncate">{inbox.domainName}</span>
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(inbox.warmupStatus)}
                          {inbox.warmupWeek > 0 && (
                            <Badge variant="outline" className="font-mono">
                              Week {inbox.warmupWeek}/6
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pb-4 flex-1">
                      <div className="rounded-xl border bg-card/50 p-4 mb-4 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Health</p>
                          <div className="flex items-end gap-1">
                            <p className={`text-3xl font-bold ${inbox.warmupScore >= 80 ? 'text-emerald-500' : inbox.warmupScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                              {inbox.warmupScore}
                            </p>
                            <span className="text-sm text-muted-foreground mb-1 font-medium">/100</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Daily Limit</p>
                          <p className="text-3xl font-bold text-foreground">{inbox.dailySendLimit}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-sm text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                        <Activity className="w-4 h-4 mr-2 text-primary/70" /> 
                        <span className="font-medium text-foreground">{inbox._count?.emailLogs || 0}</span>
                        <span className="ml-1">emails sent totally</span>
                      </div>
                    </CardContent>
                    
                    <CardFooter className="bg-muted/10 border-t p-4 flex flex-col gap-3">
                      {/* Approve Next Week Banner */}
                      {inbox.warmupStatus === 'paused' && inbox.warmupWeek > 0 && inbox.warmupWeek < 6 && (
                        <Button 
                          variant="default"
                          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md animate-pulse"
                          onClick={() => approveWeekMutation.mutate(inbox.id)}
                          disabled={approveWeekMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve Week {inbox.warmupWeek + 1} to Continue
                        </Button>
                      )}
                      <div className="flex flex-wrap gap-3 w-full">
                      {inbox.warmupStatus === 'warming' ? (
                        <Button variant="secondary" className="flex-1 font-semibold border-amber-200/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300" onClick={() => toggleWarmupMutation.mutate({ id: inbox.id, action: 'pause' })}>
                          <Pause className="w-4 h-4 mr-2" /> Pause Warmup
                        </Button>
                      ) : (
                        <Button variant="default" className="flex-1 font-semibold shadow-sm" onClick={() => toggleWarmupMutation.mutate({ id: inbox.id, action: 'start' })}>
                          <Flame className="w-4 h-4 mr-2 text-amber-300" /> Start Warmup
                        </Button>
                      )}
                      <Link href={`/inboxes/${inbox.id}`} className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0 hover:bg-primary hover:text-primary-foreground transition-colors")} title="View Incoming Emails">
                        <Mail className="w-4 h-4" />
                      </Link>
                      <Button variant="outline" size="icon" className="shrink-0 hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => openSettings(inbox)} title="Settings">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="shrink-0 hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => openTestModal(inbox)} title="Send Test Email">
                        <Send className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="shrink-0 hover:bg-destructive hover:text-destructive-foreground transition-colors text-destructive" onClick={() => {
                        if (window.confirm('Are you sure you want to delete this inbox?')) {
                          deleteInboxMutation.mutate(inbox.id);
                        }
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inbox Settings</DialogTitle>
            <DialogDescription>Modify settings and SMTP credentials for this inbox.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSettingsSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>From Name (Sender Display Name)</Label>
              <Input placeholder="e.g. Kamran Ali" value={formData.fromName} onChange={e => setFormData({...formData, fromName: e.target.value})} />
              <p className="text-xs text-muted-foreground">This is the name recipients see when they receive an email.</p>
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={formData.emailAddress} onChange={e => setFormData({...formData, emailAddress: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Daily Send Limit</Label>
              <Input type="number" min="1" value={formData.dailySendLimit} onChange={e => setFormData({...formData, dailySendLimit: Number(e.target.value)})} required />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2 col-span-3">
                <Label>SMTP Host</Label>
                <Input value={formData.smtpHost} onChange={e => setFormData({...formData, smtpHost: e.target.value})} required />
              </div>
              <div className="space-y-2 col-span-1">
                <Label>Port</Label>
                <Input type="number" value={formData.smtpPort} onChange={e => setFormData({...formData, smtpPort: Number(e.target.value)})} required />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2 col-span-3">
                <Label>IMAP Host (Optional)</Label>
                <Input value={formData.imapHost} onChange={e => setFormData({...formData, imapHost: e.target.value})} placeholder="imap.example.com" />
              </div>
              <div className="space-y-2 col-span-1">
                <Label>IMAP Port</Label>
                <Input type="number" value={formData.imapPort} onChange={e => setFormData({...formData, imapPort: Number(e.target.value)})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>SMTP Username</Label>
              <Input value={formData.smtpUser} onChange={e => setFormData({...formData, smtpUser: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>SMTP Password</Label>
              <Input type="password" placeholder="Leave blank to keep unchanged" value={formData.smtpPass} onChange={e => setFormData({...formData, smtpPass: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>IMAP Username (Optional)</Label>
              <Input value={formData.imapUser} onChange={e => setFormData({...formData, imapUser: e.target.value})} placeholder="Defaults to SMTP username" />
            </div>
            <div className="space-y-2">
              <Label>IMAP Password (Optional)</Label>
              <Input type="password" placeholder="Leave blank to keep unchanged or default to SMTP pass" value={formData.imapPass} onChange={e => setFormData({...formData, imapPass: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateInboxMutation.isPending}>
                {updateInboxMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send Test Email Dialog */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>Select a template and send a test email from {testInbox?.emailAddress}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendTest}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Recipient Email</Label>
                <Input name="toEmail" type="email" required placeholder="test@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Email Template</Label>
                <Select name="templateId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.length === 0 ? (
                      <SelectItem value="none" disabled>No templates available (create one in Settings)</SelectItem>
                    ) : (
                      templates?.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTestModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={sendTestMutation.isPending || templates?.length === 0}>Send Email</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

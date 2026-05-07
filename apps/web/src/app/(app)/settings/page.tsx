'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Edit2, Plus, User, Users, Bell, FileText, Sprout, CreditCard } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const { user } = useAuthStore();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Settings saved successfully (Mock)');
  };

  const queryClient = useQueryClient();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateText, setTemplateText] = useState('');

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => fetchApi('/templates'),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.id) {
        return fetchApi(`/templates/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
      }
      return fetchApi('/templates', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsTemplateModalOpen(false);
      toast.success('Template saved successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [editingSeed, setEditingSeed] = useState<any>(null);

  const { data: seeds, isLoading: seedsLoading } = useQuery({
    queryKey: ['seeds'],
    queryFn: () => fetchApi('/seeds'),
  });

  const saveSeedMutation = useMutation({
    mutationFn: (data: any) => fetchApi('/seeds', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seeds'] });
      setIsSeedModalOpen(false);
      toast.success('Seed account added successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteSeedMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/seeds/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seeds'] });
      toast.success('Seed account deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleSeedMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/seeds/${id}/toggle`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seeds'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSaveSeed = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email'),
      provider: formData.get('provider'),
      type: formData.get('type'),
      smtpHost: formData.get('smtpHost'),
      smtpPort: parseInt(formData.get('smtpPort') as string),
      smtpUser: formData.get('smtpUser'),
      smtpPass: formData.get('smtpPass'),
      imapHost: formData.get('imapHost') || undefined,
      imapPort: formData.get('imapPort') ? parseInt(formData.get('imapPort') as string) : undefined,
      imapUser: formData.get('imapUser') || undefined,
      imapPass: formData.get('imapPass') || undefined,
    };
    saveSeedMutation.mutate(data);
  };

  const openSeedModal = () => {
    setEditingSeed(null);
    setIsSeedModalOpen(true);
  };

  const handleSaveTemplate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      id: editingTemplate?.id,
      name: formData.get('name'),
      subject: formData.get('subject'),
      bodyHtml: templateHtml,
      bodyText: formData.get('bodyText') || templateText,
    };
    saveTemplateMutation.mutate(data);
  };

  const openTemplateModal = (template: any = null) => {
    setEditingTemplate(template);
    setTemplateHtml(template?.bodyHtml || '');
    setTemplateText(template?.bodyText || '');
    setIsTemplateModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users className="w-4 h-4" /> Team
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="w-4 h-4" /> Email Templates
          </TabsTrigger>
          <TabsTrigger value="seeds">
            <Sprout className="w-4 h-4" /> Seed Accounts
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="w-4 h-4" /> Billing
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <form onSubmit={handleSave}>
              <CardHeader>
                <CardTitle>Profile Details</CardTitle>
                <CardDescription>Update your personal information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input defaultValue={user?.name || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue={user?.email || ''} disabled />
                  <p className="text-xs text-muted-foreground">Email address cannot be changed.</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit">Save Changes</Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Invite and manage team members in your workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="colleague@company.com" className="max-w-sm" />
                  <Button variant="secondary">Invite</Button>
                </div>
                <div className="border rounded-md divide-y mt-6">
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{user?.name} (You)</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                    <Badge>Admin</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Choose what alerts you want to receive.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">New Replies</Label>
                  <p className="text-sm text-muted-foreground">Receive an email when a prospect replies.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Campaign Completed</Label>
                  <p className="text-sm text-muted-foreground">Get notified when a campaign finishes sending.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">High Bounce Rate</Label>
                  <p className="text-sm text-muted-foreground">Alert me if an inbox has a high bounce rate.</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={() => toast.success('Preferences saved')}>Save Preferences</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Email Templates</CardTitle>
                <CardDescription>Create and manage templates for use in your inboxes and campaigns.</CardDescription>
              </div>
              <Button onClick={() => openTemplateModal()}><Plus className="w-4 h-4 mr-2" /> Create Template</Button>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <p>Loading templates...</p>
              ) : templates?.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">No templates created yet.</p>
                  <Button variant="outline" onClick={() => openTemplateModal()}>Create your first template</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates?.map((t: any) => (
                    <div key={t.id} className="border p-4 rounded-md flex justify-between items-center bg-card">
                      <div>
                        <h4 className="font-bold">{t.name}</h4>
                        <p className="text-sm text-muted-foreground">{t.subject}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openTemplateModal(t)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => {
                          if (window.confirm('Delete this template?')) {
                            deleteTemplateMutation.mutate(t.id);
                          }
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seeds">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Seed Accounts</CardTitle>
                <CardDescription>Manage external seed accounts (Gmail, Outlook) to receive warmup emails.</CardDescription>
              </div>
              <Button onClick={() => openSeedModal()}><Plus className="w-4 h-4 mr-2" /> Add Seed</Button>
            </CardHeader>
            <CardContent>
              {seedsLoading ? (
                <p>Loading seed accounts...</p>
              ) : seeds?.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-4">No seed accounts added yet.</p>
                  <Button variant="outline" onClick={() => openSeedModal()}>Add your first seed</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {seeds?.map((s: any) => (
                    <div key={s.id} className="border p-4 rounded-md flex justify-between items-center bg-card">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold">{s.email}</h4>
                          <Badge variant={s.type === 'real' ? 'default' : 'secondary'}>{s.type}</Badge>
                          <Badge variant="outline" className="capitalize">{s.provider}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">SMTP: {s.smtpHost}:{s.smtpPort}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`active-${s.id}`} className="text-sm text-muted-foreground">Active</Label>
                          <Switch 
                            id={`active-${s.id}`} 
                            checked={s.isActive} 
                            onCheckedChange={() => toggleSeedMutation.mutate(s.id)} 
                            disabled={toggleSeedMutation.isPending}
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => {
                          if (window.confirm('Delete this seed account?')) {
                            deleteSeedMutation.mutate(s.id);
                          }
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>You are currently on the Enterprise Trial plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-primary/10 rounded-md border border-primary/20 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-primary">Enterprise Plan</h3>
                  <p className="text-sm text-muted-foreground">Unlimited domains, 100 inboxes, 100k emails/mo.</p>
                </div>
                <Button>Manage Billing</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>Design your email template below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTemplate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input name="name" defaultValue={editingTemplate?.name} required placeholder="e.g. Follow Up 1" />
              </div>
              <div className="space-y-2">
                <Label>Email Subject</Label>
                <Input name="subject" defaultValue={editingTemplate?.subject} required placeholder="Quick question..." />
              </div>
              <div className="space-y-2">
                <Label>Email Body</Label>
                <RichTextEditor 
                  content={templateHtml} 
                  onChange={(html, text) => {
                    setTemplateHtml(html);
                    setTemplateText(text);
                  }} 
                />
              </div>
              <div className="space-y-2">
                <Label>Plain Text Version (Advanced)</Label>
                <Textarea name="bodyText" value={templateText} onChange={e => setTemplateText(e.target.value)} placeholder="Hi {{firstName}}, ..." rows={3} />
                <p className="text-xs text-muted-foreground">Auto-generated from the rich text editor, but you can manually edit it.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveTemplateMutation.isPending}>Save Template</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSeedModalOpen} onOpenChange={setIsSeedModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Seed Account</DialogTitle>
            <DialogDescription>Add external account credentials (e.g., App Passwords) for IMAP/SMTP.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSeed} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" defaultValue="seed">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seed">Seed Account</SelectItem>
                    <SelectItem value="real">Real Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select name="provider" defaultValue="gmail">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                    <SelectItem value="custom">Custom SMTP/IMAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <h4 className="font-medium text-sm">SMTP Settings (Sending)</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input name="smtpHost" defaultValue="smtp.gmail.com" required />
              </div>
              <div className="space-y-2">
                <Label>SMTP Port</Label>
                <Input name="smtpPort" type="number" defaultValue="587" required />
              </div>
              <div className="space-y-2">
                <Label>SMTP Username</Label>
                <Input name="smtpUser" required />
              </div>
              <div className="space-y-2">
                <Label>SMTP Password (App Password)</Label>
                <Input name="smtpPass" type="password" required />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <h4 className="font-medium text-sm">IMAP Settings (Receiving / Auto-Read)</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IMAP Host</Label>
                <Input name="imapHost" defaultValue="imap.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label>IMAP Port</Label>
                <Input name="imapPort" type="number" defaultValue="993" />
              </div>
              <div className="space-y-2">
                <Label>IMAP Username (Optional)</Label>
                <Input name="imapUser" placeholder="Same as SMTP" />
              </div>
              <div className="space-y-2">
                <Label>IMAP Password (Optional)</Label>
                <Input name="imapPass" type="password" placeholder="Same as SMTP" />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsSeedModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveSeedMutation.isPending}>Add Seed Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

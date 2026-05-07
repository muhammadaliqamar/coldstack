'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useState } from 'react';
import { Globe, Plus, Trash2, CheckCircle2, XCircle, Edit2 } from 'lucide-react';

export default function DomainsPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({ domainName: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' });

  const [isCreateInboxOpen, setIsCreateInboxOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<any>(null);
  const [inboxCount, setInboxCount] = useState(1);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ domainName: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' });

  const { data: domains, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => fetchApi('/domains'),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => fetchApi('/domains', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      setIsAddOpen(false);
      toast.success('Domain added successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => fetchApi(`/domains/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      setIsEditOpen(false);
      toast.success('Domain updated successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/domains/${id}/verify`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      if (data.verified) toast.success('SMTP connection verified!');
      else toast.error(`Verification failed: ${data.error}`);
    },
  });

  const createInboxesMutation = useMutation({
    mutationFn: ({ id, count }: { id: string, count: number }) => fetchApi(`/domains/${id}/create-inboxes`, { method: 'POST', body: JSON.stringify({ count }) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      setIsCreateInboxOpen(false);
      toast.success(data.message);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/domains/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Domain deleted');
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate({ ...formData, smtpPort: Number(formData.smtpPort) });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomain) return;

    const submitData = { ...editFormData, smtpPort: Number(editFormData.smtpPort) };
    if (!submitData.smtpPass) {
      delete (submitData as any).smtpPass;
    }

    editMutation.mutate({ id: selectedDomain.id, data: submitData });
  };

  const handleCreateInboxesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomain) return;
    createInboxesMutation.mutate({ id: selectedDomain.id, count: inboxCount });
  };

  const openCreateInboxes = (domain: any) => {
    setSelectedDomain(domain);
    setInboxCount(3 - domain.inboxCount);
    setIsCreateInboxOpen(true);
  };

  const openEditDomain = (domain: any) => {
    setSelectedDomain(domain);
    setEditFormData({
      domainName: domain.domainName,
      smtpHost: domain.smtpHost,
      smtpPort: domain.smtpPort,
      smtpUser: domain.smtpUser,
      smtpPass: '' // empty means no change
    });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Domains</h2>
          <p className="text-muted-foreground">Manage your custom domains and SMTP connections.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger className={buttonVariants({ variant: "default" })}>
            <Plus className="w-4 h-4 mr-2" /> Add Domain
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Domain</DialogTitle>
              <DialogDescription>Enter your domain and SMTP credentials to connect it.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Domain Name</Label>
                <Input placeholder="example.com" value={formData.domainName} onChange={e => setFormData({...formData, domainName: e.target.value})} required />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2 col-span-3">
                  <Label>SMTP Host</Label>
                  <Input placeholder="smtp.example.com" value={formData.smtpHost} onChange={e => setFormData({...formData, smtpHost: e.target.value})} required />
                </div>
                <div className="space-y-2 col-span-1">
                  <Label>Port</Label>
                  <Input type="number" value={formData.smtpPort} onChange={e => setFormData({...formData, smtpPort: Number(e.target.value)})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>SMTP Username</Label>
                <Input value={formData.smtpUser} onChange={e => setFormData({...formData, smtpUser: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>SMTP Password</Label>
                <Input type="password" value={formData.smtpPass} onChange={e => setFormData({...formData, smtpPass: e.target.value})} required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Saving...' : 'Save Domain'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inboxes</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : domains?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No domains added yet</TableCell></TableRow>
            ) : (
              domains?.map((domain: any) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    {domain.domainName}
                  </TableCell>
                  <TableCell>
                    {domain.verified ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><XCircle className="w-3 h-3 mr-1" /> Unverified</Badge>
                    )}
                  </TableCell>
                  <TableCell>{domain.inboxCount} / 3</TableCell>
                  <TableCell>{new Date(domain.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {!domain.verified && (
                      <Button variant="outline" size="sm" onClick={() => verifyMutation.mutate(domain.id)} disabled={verifyMutation.isPending}>
                        Verify
                      </Button>
                    )}
                    {domain.verified && domain.inboxCount < 3 && (
                      <Button variant="outline" size="sm" onClick={() => openCreateInboxes(domain)} disabled={createInboxesMutation.isPending}>
                        Create Inboxes
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEditDomain(domain)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(domain.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Domain Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Custom Domain</DialogTitle>
            <DialogDescription>Update your domain and SMTP credentials. Changing credentials will require re-verification.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Domain Name</Label>
              <Input placeholder="example.com" value={editFormData.domainName} onChange={e => setEditFormData({...editFormData, domainName: e.target.value})} required />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2 col-span-3">
                <Label>SMTP Host</Label>
                <Input placeholder="smtp.example.com" value={editFormData.smtpHost} onChange={e => setEditFormData({...editFormData, smtpHost: e.target.value})} required />
              </div>
              <div className="space-y-2 col-span-1">
                <Label>Port</Label>
                <Input type="number" value={editFormData.smtpPort} onChange={e => setEditFormData({...editFormData, smtpPort: Number(e.target.value)})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>SMTP Username</Label>
              <Input value={editFormData.smtpUser} onChange={e => setEditFormData({...editFormData, smtpUser: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>SMTP Password</Label>
              <Input type="password" placeholder="Leave blank to keep unchanged" value={editFormData.smtpPass} onChange={e => setEditFormData({...editFormData, smtpPass: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Inboxes Dialog */}
      <Dialog open={isCreateInboxOpen} onOpenChange={setIsCreateInboxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Inboxes</DialogTitle>
            <DialogDescription>
              How many automated outreach inboxes would you like to generate for {selectedDomain?.domainName}?
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInboxesSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Number of Inboxes</Label>
              <Input 
                type="number" 
                min="1" 
                max={selectedDomain ? 3 - selectedDomain.inboxCount : 3} 
                value={inboxCount} 
                onChange={e => setInboxCount(Number(e.target.value))} 
                required 
              />
              <p className="text-xs text-muted-foreground">
                You can create up to {selectedDomain ? 3 - selectedDomain.inboxCount : 3} more inboxes for this domain.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateInboxOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createInboxesMutation.isPending}>
                {createInboxesMutation.isPending ? 'Creating...' : 'Create Inboxes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

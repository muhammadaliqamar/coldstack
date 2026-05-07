'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Megaphone, Plus, Trash2, Play, Pause, Square, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function CampaignsPage() {
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', 'all'],
    queryFn: () => fetchApi('/campaigns'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string, action: string }) => fetchApi(`/campaigns/${id}/${action}`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(data.message);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <Badge className="bg-emerald-500 hover:bg-emerald-600">Running</Badge>;
      case 'paused': return <Badge variant="secondary" className="bg-amber-500/20 text-amber-500">Paused</Badge>;
      case 'completed': return <Badge variant="outline">Completed</Badge>;
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">Create and manage your email outreach campaigns.</p>
        </div>
        
        <Link href="/campaigns/new" className={buttonVariants({ variant: "default" })}>
          <Plus className="w-4 h-4 mr-2" /> New Campaign
        </Link>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Target List</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Open Rate</TableHead>
              <TableHead>Reply Rate</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : campaigns?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No campaigns found</TableCell></TableRow>
            ) : (
              campaigns?.map((campaign: any) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-muted-foreground" />
                    {campaign.name}
                  </TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {campaign.emailList ? `${campaign.emailList.name} (${campaign.emailList.totalContacts})` : 'No list attached'}
                  </TableCell>
                  <TableCell>{campaign.stats?.sent || 0}</TableCell>
                  <TableCell>{((campaign.stats?.openRate || 0) * 100).toFixed(1)}%</TableCell>
                  <TableCell>{((campaign.stats?.replyRate || 0) * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right space-x-2">
                    {campaign.status === 'draft' && (
                      <Button variant="outline" size="sm" onClick={() => toggleStatusMutation.mutate({ id: campaign.id, action: 'start' })}>
                        <Play className="w-4 h-4 mr-1" /> Start
                      </Button>
                    )}
                    {campaign.status === 'running' && (
                      <Button variant="outline" size="sm" onClick={() => toggleStatusMutation.mutate({ id: campaign.id, action: 'pause' })}>
                        <Pause className="w-4 h-4 mr-1" /> Pause
                      </Button>
                    )}
                    {campaign.status === 'paused' && (
                      <Button variant="outline" size="sm" onClick={() => toggleStatusMutation.mutate({ id: campaign.id, action: 'resume' })}>
                        <Play className="w-4 h-4 mr-1" /> Resume
                      </Button>
                    )}
                    {['running', 'paused'].includes(campaign.status) && (
                      <Button variant="outline" size="sm" onClick={() => toggleStatusMutation.mutate({ id: campaign.id, action: 'stop' })}>
                        <Square className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(campaign.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

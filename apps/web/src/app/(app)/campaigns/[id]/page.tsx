'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, Users, MousePointerClick, Reply, MailX, Send } from 'lucide-react';
import Link from 'next/link';

export default function CampaignDetailPage() {
  const params = useParams();
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', params.id],
    queryFn: () => fetchApi(`/campaigns/${params.id}`),
  });

  if (isLoading) return <div className="p-8">Loading campaign details...</div>;
  if (!campaign) return <div className="p-8">Campaign not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{campaign.name}</h2>
            <Badge variant={campaign.status === 'running' ? 'default' : 'secondary'}>{campaign.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Targeting {campaign.emailList?.name} ({campaign.emailList?.totalContacts} contacts)
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sequences">Sequences ({campaign.sequences.length})</TabsTrigger>
          <TabsTrigger value="inboxes">Inboxes ({campaign.campaignInboxes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaign.sequences.reduce((acc: number, s: any) => acc + (s.stats?.sent || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Opened</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaign.sequences.reduce((acc: number, s: any) => acc + (s.stats?.opened || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Replied</CardTitle>
                <Reply className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaign.sequences.reduce((acc: number, s: any) => acc + (s.stats?.replied || 0), 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bounced</CardTitle>
                <MailX className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {campaign.sequences.reduce((acc: number, s: any) => acc + (s.stats?.bounced || 0), 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sequence Performance</CardTitle>
              <CardDescription>Funnel breakdown step by step</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Step</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Opened</TableHead>
                    <TableHead>Replied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.sequences.map((seq: any) => (
                    <TableRow key={seq.id}>
                      <TableCell>Day {seq.delayDays}</TableCell>
                      <TableCell className="font-medium">{seq.subject}</TableCell>
                      <TableCell><Badge variant="outline">{seq.condition.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell>{seq.stats?.sent || 0}</TableCell>
                      <TableCell>{seq.stats?.opened || 0}</TableCell>
                      <TableCell>{seq.stats?.replied || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inboxes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Inboxes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.campaignInboxes.map((ci: any) => (
                    <TableRow key={ci.id}>
                      <TableCell className="font-medium">{ci.inbox.emailAddress}</TableCell>
                      <TableCell><Badge variant="outline">{ci.inbox.warmupStatus}</Badge></TableCell>
                      <TableCell>{ci.inbox.warmupScore}/100</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

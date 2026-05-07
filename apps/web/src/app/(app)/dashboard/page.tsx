'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Megaphone, Users, Reply, MailX, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => fetchApi('/analytics/overview'),
  });

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => fetchApi('/campaigns?status=running'),
  });

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSent || 0}</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((stats?.openRate || 0) * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{stats?.totalOpened || 0} opened</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Reply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((stats?.replyRate || 0) * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{stats?.totalReplied || 0} replies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.conversions || 0}</div>
            <p className="text-xs text-muted-foreground">{((stats?.conversionRate || 0) * 100).toFixed(2)}% rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <MailX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((stats?.bounceRate || 0) * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{stats?.totalBounced || 0} bounced</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Sent vs Replied</CardTitle>
            <CardDescription>Daily breakdown over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.dailyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
            <CardDescription>Currently running campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {campaigns?.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No active campaigns</div>
              ) : (
                campaigns?.slice(0, 5).map((campaign: any) => (
                  <div key={campaign.id} className="flex items-center">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {campaign.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {campaign.stats?.sent || 0} sent • {((campaign.stats?.openRate || 0) * 100).toFixed(0)}% open
                      </p>
                    </div>
                    <div className="ml-auto font-medium">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Running
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Input } from '@/components/ui/input';

export default function AnalyticsPage() {
  const [filterDate, setFilterDate] = useState<string>('');

  const { data: funnel } = useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => fetchApi('/analytics/funnel'),
  });

  const { data: inboxes } = useQuery({
    queryKey: ['analytics', 'inboxes'],
    queryFn: () => fetchApi('/analytics/inboxes'),
  });

  const { data: warmupStats } = useQuery({
    queryKey: ['analytics', 'warmup', filterDate],
    queryFn: () => fetchApi(filterDate ? `/analytics/warmup?date=${filterDate}` : '/analytics/warmup'),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Overview</h2>
          <p className="text-muted-foreground">Deep dive into your campaign and warmup performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Date Filter:</label>
          <Input 
            type="date" 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-[180px]"
          />
          {filterDate && (
            <button onClick={() => setFilterDate('')} className="text-sm text-muted-foreground hover:text-foreground">Clear</button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Sales Funnel</CardTitle>
            <CardDescription>Lead progression across all campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel || []} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                  <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stage" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} 
                    tickFormatter={(val) => val.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  />
                  <Tooltip cursor={{fill: '#27272a'}} contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Warmup Daily Breakdown</CardTitle>
            <CardDescription>Last 30 days warmup activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={warmupStats?.dailyBreakdown || []} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                  <Legend />
                  <Bar dataKey="sent" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="replied" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="bounced" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Warmup Performance {filterDate ? `(${filterDate})` : '(All Time)'}</CardTitle>
          <CardDescription>Sent, replied, and bounced stats per inbox</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Replied</TableHead>
                <TableHead>Bounced</TableHead>
                <TableHead>Spam</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warmupStats?.inboxStats?.map((inbox: any) => (
                <TableRow key={inbox.id}>
                  <TableCell className="font-medium">{inbox.emailAddress}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-muted overflow-hidden rounded-full">
                        <div className={`h-full ${inbox.warmupScore >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${inbox.warmupScore}%` }} />
                      </div>
                      <span className="text-xs">{inbox.warmupScore}</span>
                    </div>
                  </TableCell>
                  <TableCell>{inbox.periodSent}</TableCell>
                  <TableCell>{inbox.periodReplied}</TableCell>
                  <TableCell className={inbox.periodBounced > 0 ? 'text-red-500' : ''}>
                    {inbox.periodBounced}
                  </TableCell>
                  <TableCell>{inbox.totalSpam || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

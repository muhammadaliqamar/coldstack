'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const { data: funnel } = useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => fetchApi('/analytics/funnel'),
  });

  const { data: inboxes } = useQuery({
    queryKey: ['analytics', 'inboxes'],
    queryFn: () => fetchApi('/analytics/inboxes'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics Overview</h2>
        <p className="text-muted-foreground">Deep dive into your campaign performance.</p>
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
            <CardTitle>Inbox Performance</CardTitle>
            <CardDescription>Health and deliverability per inbox</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Reply Rate</TableHead>
                  <TableHead>Bounce Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inboxes?.map((inbox: any) => (
                  <TableRow key={inbox.id}>
                    <TableCell className="font-medium">{inbox.emailAddress}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 bg-muted overflow-hidden rounded-full">
                          <div className={`h-full ${inbox.healthScore >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${inbox.healthScore}%` }} />
                        </div>
                        <span className="text-xs">{inbox.healthScore}</span>
                      </div>
                    </TableCell>
                    <TableCell>{inbox.totalSent}</TableCell>
                    <TableCell>{(inbox.replyRate * 100).toFixed(1)}%</TableCell>
                    <TableCell className={inbox.bounceRate > 0.05 ? 'text-red-500' : ''}>
                      {(inbox.bounceRate * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

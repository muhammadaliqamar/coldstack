'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

export default function ListDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const page = searchParams.get('page') || '1';
  const search = searchParams.get('search') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', params.id, page, search],
    queryFn: () => fetchApi(`/lists/${params.id}/contacts?page=${page}&search=${search}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/lists" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contact List</h2>
          <p className="text-muted-foreground">Viewing contacts for list #{params.id?.toString().slice(-6)}</p>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b flex items-center">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search emails or names..." className="pl-9" defaultValue={search} />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : data?.contacts?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No contacts found</TableCell></TableRow>
            ) : (
              data?.contacts?.map((contact: any) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.email}</TableCell>
                  <TableCell>{contact.firstName} {contact.lastName}</TableCell>
                  <TableCell>{contact.company}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      contact.status === 'bounced' ? 'border-red-500 text-red-500 bg-red-500/10' :
                      contact.status === 'replied' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' :
                      contact.status === 'unsubscribed' ? 'border-orange-500 text-orange-500 bg-orange-500/10' : ''
                    }>
                      {contact.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="p-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {data?.contacts?.length || 0} of {data?.pagination?.total || 0} contacts
          </div>
          <div className="space-x-2">
            <span className="font-medium">Page {data?.pagination?.page || 1} of {data?.pagination?.pages || 1}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

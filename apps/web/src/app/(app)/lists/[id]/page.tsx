'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ShieldCheck, Download, Check, X, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function ListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const page = searchParams.get('page') || '1';
  const search = searchParams.get('search') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', params.id, page, search],
    queryFn: () => fetchApi(`/lists/${params.id}/contacts?page=${page}&search=${search}`),
  });

  const verifyAllMutation = useMutation({
    mutationFn: () => fetchApi(`/lists/${params.id}/verify-all`, { method: 'POST' }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', params.id] });
      toast.success(`Verification complete! Verified: ${res.verifiedCount}, Invalid: ${res.invalidCount}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Verification failed');
    },
  });

  const exportToCSV = () => {
    if (!data?.contacts || data.contacts.length === 0) {
      toast.warning('No contacts available to export');
      return;
    }
    const headers = ['Email', 'First Name', 'Last Name', 'Company', 'Title', 'Phone', 'Verification Status', 'Engagement Status'];
    const rows = data.contacts.map((c: any) => [
      c.email,
      c.firstName || '',
      c.lastName || '',
      c.company || '',
      c.title || '',
      c.phone || '',
      c.verificationStatus || 'unverified',
      c.status || 'new_contact'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `contacts_list_${params.id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('List exported to CSV (Excel compatible) successfully!');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const urlParams = new URLSearchParams(window.location.search);
    if (val) {
      urlParams.set('search', val);
    } else {
      urlParams.delete('search');
    }
    urlParams.set('page', '1'); // Reset to page 1 on search
    router.push(`/lists/${params.id}?${urlParams.toString()}`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/lists" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Contact List</h2>
            <p className="text-muted-foreground font-semibold mt-1">Viewing contacts for list #{params.id?.toString().slice(-6)}</p>
          </div>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="rounded-xl border border-border/60 font-semibold text-xs flex items-center gap-2 cursor-pointer w-full sm:w-auto"
            onClick={exportToCSV}
            disabled={!data?.contacts || data.contacts.length === 0}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>

          <Button
            className="rounded-xl font-semibold text-xs bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm flex items-center gap-2 cursor-pointer w-full sm:w-auto"
            onClick={() => verifyAllMutation.mutate()}
            disabled={verifyAllMutation.isPending || !data?.contacts || data.contacts.length === 0}
          >
            {verifyAllMutation.isPending ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Verify All Leads
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="border border-border/50 shadow-md rounded-2xl bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center bg-muted/10">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search emails or names..." 
              className="pl-9 rounded-xl border border-border/70 focus-visible:ring-1 focus-visible:ring-primary bg-card" 
              defaultValue={search} 
              onChange={handleSearchChange}
            />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-bold text-foreground">Email</TableHead>
              <TableHead className="font-bold text-foreground">Name</TableHead>
              <TableHead className="font-bold text-foreground">Company</TableHead>
              <TableHead className="font-bold text-foreground">Title</TableHead>
              <TableHead className="font-bold text-foreground">Verification</TableHead>
              <TableHead className="font-bold text-foreground">Engagement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-semibold">Loading contacts...</TableCell></TableRow>
            ) : data?.contacts?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-semibold">No contacts found in this list</TableCell></TableRow>
            ) : (
              data?.contacts?.map((contact: any) => (
                <TableRow key={contact.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-foreground font-medium">{contact.email}</td>
                  <td className="px-6 py-4 font-semibold text-foreground">{contact.firstName || '-'} {contact.lastName || ''}</td>
                  <td className="px-6 py-4 font-bold text-foreground">{contact.company || '-'}</td>
                  <td className="px-6 py-4 text-muted-foreground font-semibold">{contact.title || '-'}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`rounded-full text-[10px] font-extrabold px-2.5 py-0.5 border ${
                      contact.verificationStatus === 'verified' 
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600' 
                        : contact.verificationStatus === 'invalid' 
                          ? 'border-red-500/25 bg-red-500/10 text-red-600' 
                          : 'border-slate-300 bg-slate-100 text-slate-500'
                    }`}>
                      {contact.verificationStatus === 'verified' && <Check className="w-3 h-3 mr-1 inline-block shrink-0" />}
                      {contact.verificationStatus === 'invalid' && <X className="w-3 h-3 mr-1 inline-block shrink-0" />}
                      {contact.verificationStatus || 'unverified'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`rounded-full text-[10px] font-extrabold px-2.5 py-0.5 border ${
                      contact.status === 'bounced' ? 'border-red-500/20 bg-red-500/10 text-red-600' :
                      contact.status === 'replied' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' :
                      contact.status === 'unsubscribed' ? 'border-orange-500/20 bg-orange-500/10 text-orange-600' : 
                      contact.status === 'converted' ? 'border-blue-500/20 bg-blue-500/10 text-blue-600' : 'border-border/60 bg-muted/30 text-muted-foreground'
                    }`}>
                      {contact.status.replace('_', ' ')}
                    </Badge>
                  </td>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="p-4 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-muted-foreground bg-muted/10">
          <div>
            Showing {data?.contacts?.length || 0} of {data?.pagination?.total || 0} contacts
          </div>
          <div className="flex gap-2">
            <span className="font-bold text-foreground">Page {data?.pagination?.page || 1} of {data?.pagination?.pages || 1}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

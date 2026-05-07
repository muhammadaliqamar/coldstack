'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Users, Upload, Trash2, FileSpreadsheet, Eye } from 'lucide-react';
import Link from 'next/link';

export default function ListsPage() {
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const { data: lists, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => fetchApi('/lists'),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
      return fetchApi('/lists/upload', { method: 'POST', body: formData });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setIsUploadOpen(false);
      setFile(null);
      toast.success(`Imported ${data.imported} contacts successfully`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchApi(`/lists/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      toast.success('List deleted');
    },
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    uploadMutation.mutate(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Email Lists</h2>
          <p className="text-muted-foreground">Upload and manage your target audience lists.</p>
        </div>
        
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger className={buttonVariants({ variant: "default" })}>
            <Upload className="w-4 h-4 mr-2" /> Upload CSV/XLSX
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Contact List</DialogTitle>
              <DialogDescription>Upload a CSV or Excel file containing your prospects.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4 py-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center bg-muted/10">
                <Input type="file" accept=".csv,.xlsx,.xls" className="hidden" id="file-upload" onChange={e => setFile(e.target.files?.[0] || null)} />
                <Label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
                  <span className="font-medium">{file ? file.name : 'Click to select file'}</span>
                  <span className="text-xs text-muted-foreground mt-1">Maximum file size: 10MB</span>
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={!file || uploadMutation.isPending}>
                {uploadMutation.isPending ? 'Processing...' : 'Upload & Import'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>List Name</TableHead>
              <TableHead>File Source</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : lists?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No lists uploaded yet</TableCell></TableRow>
            ) : (
              lists?.map((list: any) => (
                <TableRow key={list.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {list.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{list.fileName}</TableCell>
                  <TableCell>{list.totalContacts.toLocaleString()}</TableCell>
                  <TableCell>{new Date(list.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Link href={`/lists/${list.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      <Eye className="w-4 h-4" />
                    </Link>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(list.id)}>
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

// Ensure Label is imported or define a quick placeholder (using shadcn Label is ideal, but let's define it here if missing for simplicity)
function Label({ htmlFor, className, children }: { htmlFor: string, className?: string, children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className={className}>{children}</label>;
}

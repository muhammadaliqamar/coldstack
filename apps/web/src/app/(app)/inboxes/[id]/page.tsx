'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MailOpen, Mail, Clock, User, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatDistanceToNow, format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function InboxViewerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const { data: inbox, isLoading: inboxLoading } = useQuery({
    queryKey: ['inbox', id],
    queryFn: () => fetchApi(`/inboxes/${id}`),
  });

  const { data: emails, isLoading: emailsLoading, error } = useQuery({
    queryKey: ['inbox-emails', id],
    queryFn: () => fetchApi(`/inboxes/${id}/emails`),
  });

  const { data: emailContent, isLoading: contentLoading } = useQuery({
    queryKey: ['inbox-email', id, selectedUid],
    queryFn: () => fetchApi(`/inboxes/${id}/emails/${selectedUid}`),
    enabled: !!selectedUid,
  });

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/inboxes')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Inbox</h2>
            <p className="text-muted-foreground">
              {inboxLoading ? 'Loading...' : inbox?.emailAddress}
            </p>
          </div>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="flex items-center text-lg">
            <Mail className="w-5 h-5 mr-2" /> Recent Incoming Emails
          </CardTitle>
          <CardDescription>
            Showing the latest 50 messages from the INBOX folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          {emailsLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Connecting to IMAP and fetching emails...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-destructive">
              <h3 className="text-lg font-bold mb-2">Connection Error</h3>
              <p className="mb-4">Failed to connect to the IMAP server for this inbox.</p>
              <p className="text-sm opacity-80">Make sure the IMAP Host and Port are correct in Settings.</p>
            </div>
          ) : emails?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <MailOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-bold">No emails found</h3>
              <p>The INBOX folder is currently empty.</p>
            </div>
          ) : (
            <div className="divide-y">
              {emails?.map((email: any) => (
                <div 
                  key={email.uid} 
                  className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center gap-4 group"
                  onClick={() => setSelectedUid(email.uid)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                      {email.subject || '(No Subject)'}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground mt-1 gap-3">
                      <span className="flex items-center truncate max-w-[200px]">
                        <User className="w-3 h-3 mr-1 shrink-0" />
                        <span className="truncate">{email.from}</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center shrink-0">
                    <Clock className="w-3 h-3 mr-1" />
                    {email.date ? formatDistanceToNow(new Date(email.date), { addSuffix: true }) : 'Unknown date'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedUid} onOpenChange={(open) => !open && setSelectedUid(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          {contentLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Fetching email content...</p>
            </div>
          ) : emailContent ? (
            <>
              <DialogHeader className="p-6 pb-4 border-b bg-muted/10 shrink-0">
                <DialogTitle className="text-xl pr-6">{emailContent.subject || '(No Subject)'}</DialogTitle>
                <DialogDescription render={<div className="mt-4 flex flex-col gap-2 text-sm" />}>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <p><strong className="font-semibold text-foreground">From:</strong> {emailContent.from}</p>
                      <p><strong className="font-semibold text-foreground">To:</strong> {emailContent.to}</p>
                    </div>
                    <p className="text-muted-foreground whitespace-nowrap">
                      {emailContent.date ? format(new Date(emailContent.date), 'PPpp') : ''}
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 bg-white dark:bg-zinc-950 relative overflow-hidden">
                {emailContent.html ? (
                  <iframe 
                    srcDoc={emailContent.html} 
                    className="w-full h-full border-0 bg-white" 
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                    title="Email Content"
                  />
                ) : (
                  <ScrollArea className="h-full w-full">
                    <pre className="p-6 text-sm font-sans whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                      {emailContent.text || 'No content available.'}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-destructive">Failed to load email content.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

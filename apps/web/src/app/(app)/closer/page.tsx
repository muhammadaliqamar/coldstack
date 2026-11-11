'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, Edit3, Send, Sparkles, User, Briefcase, Globe, Activity } from 'lucide-react';

export default function CloserPage() {
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftReply, setDraftReply] = useState('');

  // Fetch all leads currently in negotiation stage
  const { data: negotiations, isLoading } = useQuery({
    queryKey: ['closer-negotiations'],
    queryFn: () => fetchApi('/leads/closer/negotiations'),
  });

  const selectedLead = negotiations?.find((n: any) => n.id === selectedLeadId) || (negotiations?.length > 0 ? negotiations[0] : null);

  if (selectedLead && !selectedLeadId) {
    setSelectedLeadId(selectedLead.id);
    setDraftReply(selectedLead.aiDraftReply || '');
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/leads/${id}/closer/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closer-negotiations'] });
      setSelectedLeadId(null);
      setIsEditing(false);
      toast.success('AI proposal approved and sent!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Approval failed');
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, draftText }: { id: string; draftText: string }) =>
      fetchApi(`/leads/${id}/closer/edit`, { method: 'POST', body: JSON.stringify({ draftText }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closer-negotiations'] });
      setIsEditing(false);
      toast.success('AI draft reply updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update draft');
    },
  });

  const handleApprove = () => {
    if (!selectedLead) return;
    approveMutation.mutate(selectedLead.id);
  };

  const handleSaveEdit = () => {
    if (!selectedLead || !draftReply) return;
    editMutation.mutate({ id: selectedLead.id, draftText: draftReply });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
          AI Deal Closer Panel
        </h2>
        <p className="text-muted-foreground mt-2 text-lg">
          Negotiate objections and close high-value deals with AI-powered drafts awaiting your approval.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center p-12 text-muted-foreground">Loading negotiations...</div>
      ) : negotiations?.length === 0 ? (
        <Card className="border-dashed border-2 flex flex-col items-center justify-center p-20 text-center bg-card/30 rounded-2xl min-h-[350px]">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-60 animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-foreground">All Deals Closed or Nurtured</h3>
          <p className="text-muted-foreground max-w-sm mt-2 text-sm">
            There are currently no deals in the Bottom of Funnel closing stage requiring AI draft approval.
          </p>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Active Deals Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-bold text-lg text-foreground px-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Active Deal Room
            </h3>
            <div className="space-y-3">
              {negotiations?.map((n: any) => {
                const isSelected = selectedLead?.id === n.id;
                return (
                  <Card
                    key={n.id}
                    className={`cursor-pointer border-border/50 hover:shadow-md transition-all rounded-xl ${
                      isSelected ? 'border-primary/50 ring-1 ring-primary/20 bg-muted/20' : 'bg-card'
                    }`}
                    onClick={() => {
                      setSelectedLeadId(n.id);
                      setDraftReply(n.aiDraftReply || '');
                      setIsEditing(false);
                    }}
                  >
                    <CardHeader className="p-4 space-y-1">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                          {n.aiStatus === 'pending_approval' ? 'Pending Approval' : 'Negotiating'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-semibold font-mono">BOFU</span>
                      </div>
                      <CardTitle className="text-sm font-bold text-foreground truncate pt-1">
                        {n.contact.firstName} {n.contact.lastName}
                      </CardTitle>
                      <CardDescription className="text-xs truncate font-medium">{n.contact.company}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Draft Approval & Edit Panel */}
          {selectedLead && (
            <Card className="lg:col-span-2 border-border/50 shadow-lg rounded-2xl bg-card flex flex-col h-full">
              <CardHeader className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/10">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Deal with {selectedLead.contact.firstName} {selectedLead.contact.lastName}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1 text-muted-foreground"><Briefcase className="w-3.5 h-3.5" /> {selectedLead.contact.title} @ {selectedLead.contact.company}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><Globe className="w-3.5 h-3.5" /> via {selectedLead.campaign?.name}</span>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="border-border/60 hover:bg-muted/50 rounded-xl"
                    onClick={() => {
                      setIsEditing(!isEditing);
                      if (!isEditing) setDraftReply(selectedLead.aiDraftReply || '');
                    }}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    {isEditing ? 'Cancel Edit' : 'Edit Draft'}
                  </Button>
                  <Button
                    onClick={handleApprove}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md rounded-xl transition-all"
                    disabled={approveMutation.isPending || !selectedLead.aiDraftReply}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Approve & Send Proposal
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-6 flex-1 space-y-6">
                {selectedLead.aiDraftReply ? (
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      AI-Drafted Closing Proposal
                    </Label>
                    {isEditing ? (
                      <div className="space-y-4">
                        <Textarea
                          className="min-h-[250px] rounded-xl font-mono text-sm leading-relaxed"
                          value={draftReply}
                          onChange={(e) => setDraftReply(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button onClick={handleSaveEdit} className="bg-primary text-primary-foreground font-semibold rounded-xl">
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-muted/30 border rounded-2xl text-sm leading-relaxed text-foreground font-sans whitespace-pre-wrap">
                        {selectedLead.aiDraftReply}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 rounded-2xl bg-muted/20">
                    <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                    <h4 className="font-bold text-foreground">Closer Draft Pending</h4>
                    <p className="text-muted-foreground text-xs max-w-xs mt-1">
                      Obtaining prospect details... AI closer is preparing an initial proposal negotiation draft.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/10 border-t p-4 text-center">
                <p className="text-xs text-muted-foreground mx-auto">
                  💡 Sales draft created automatically based on customer conversation replies. Edit or approve to close the deal.
                </p>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

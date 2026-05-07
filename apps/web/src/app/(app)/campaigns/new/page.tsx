'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Save } from 'lucide-react';

export default function CampaignWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    emailListId: '',
    inboxIds: [] as string[],
    dailyLimit: 50,
    trackOpens: true,
    trackClicks: true,
    sequences: [
      { stepNumber: 1, subject: '', bodyHtml: '', bodyText: '', delayDays: 0, condition: 'always' }
    ]
  });

  const { data: lists } = useQuery({ queryKey: ['lists'], queryFn: () => fetchApi('/lists') });
  const { data: inboxes } = useQuery({ queryKey: ['inboxes'], queryFn: () => fetchApi('/inboxes') });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetchApi('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Campaign created successfully');
      router.push('/campaigns');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = () => {
    createMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Create Campaign</h2>
        <div className="flex items-center gap-2 mt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Basic Information'}
            {step === 2 && 'Select Audience'}
            {step === 3 && 'Email Sequence'}
            {step === 4 && 'Review & Settings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 min-h-[400px]">
          {step === 1 && (
            <div className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Q3 Outbound" />
              </div>
              <div className="space-y-2">
                <Label>Daily Send Limit (per inbox)</Label>
                <Input type="number" value={formData.dailyLimit} onChange={e => setFormData({...formData, dailyLimit: Number(e.target.value)})} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 max-w-xl">
              <div className="space-y-2">
                <Label>Select Target List</Label>
                <Select value={formData.emailListId} onValueChange={v => setFormData({...formData, emailListId: v || ''})}>
                  <SelectTrigger><SelectValue placeholder="Choose a list..." /></SelectTrigger>
                  <SelectContent>
                    {lists?.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.totalContacts} contacts)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Select Inboxes</Label>
                <div className="grid gap-2 border rounded-md p-4 bg-muted/20">
                  {inboxes?.filter((i: any) => i.warmupStatus === 'ready' || i.warmupStatus === 'warming').map((inbox: any) => (
                    <div key={inbox.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={inbox.id} 
                        checked={formData.inboxIds.includes(inbox.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setFormData({...formData, inboxIds: [...formData.inboxIds, inbox.id]});
                          else setFormData({...formData, inboxIds: formData.inboxIds.filter(id => id !== inbox.id)});
                        }}
                      />
                      <label htmlFor={inbox.id} className="text-sm font-medium leading-none cursor-pointer">
                        {inbox.emailAddress} - {inbox.warmupScore}/100 Health
                      </label>
                    </div>
                  ))}
                  {inboxes?.length === 0 && <p className="text-sm text-muted-foreground">No active inboxes available.</p>}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
              {formData.sequences.map((seq, index) => (
                <div key={index} className="space-y-4 border rounded-md p-4 relative bg-muted/10">
                  <div className="absolute top-4 right-4 text-sm font-medium text-muted-foreground">Step {seq.stepNumber}</div>
                  
                  {index > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Wait (Days)</Label>
                        <Input type="number" value={seq.delayDays} onChange={e => {
                          const newSeq = [...formData.sequences];
                          newSeq[index].delayDays = Number(e.target.value);
                          setFormData({...formData, sequences: newSeq});
                        }} />
                      </div>
                      <div className="space-y-2">
                        <Label>Condition</Label>
                        <Select value={seq.condition} onValueChange={v => {
                          const newSeq = [...formData.sequences];
                          newSeq[index].condition = v || 'always';
                          setFormData({...formData, sequences: newSeq});
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="always">Always</SelectItem>
                            <SelectItem value="not_opened">If not opened</SelectItem>
                            <SelectItem value="not_replied">If not replied</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Subject Line</Label>
                    <Input value={seq.subject} placeholder="Quick question {{firstName}}" onChange={e => {
                      const newSeq = [...formData.sequences];
                      newSeq[index].subject = e.target.value;
                      setFormData({...formData, sequences: newSeq});
                    }} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Email Body (HTML/Text)</Label>
                    <Textarea className="min-h-[150px] font-mono text-sm" value={seq.bodyHtml} placeholder="Hi {{firstName}}, ..." onChange={e => {
                      const newSeq = [...formData.sequences];
                      newSeq[index].bodyHtml = e.target.value;
                      newSeq[index].bodyText = e.target.value.replace(/<[^>]*>?/gm, ''); // simple text extraction
                      setFormData({...formData, sequences: newSeq});
                    }} />
                    <p className="text-xs text-muted-foreground">Variables: {`{{firstName}}, {{lastName}}, {{company}}`}</p>
                  </div>
                </div>
              ))}
              
              <Button type="button" variant="outline" onClick={() => {
                setFormData({
                  ...formData,
                  sequences: [...formData.sequences, { stepNumber: formData.sequences.length + 1, subject: '', bodyHtml: '', bodyText: '', delayDays: 3, condition: 'not_replied' }]
                });
              }}>+ Add Step</Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 max-w-xl">
              <div className="space-y-4 border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Open Tracking</Label>
                    <p className="text-sm text-muted-foreground">Track when recipients open your emails.</p>
                  </div>
                  <Checkbox checked={formData.trackOpens} onCheckedChange={(c: boolean) => setFormData({...formData, trackOpens: c})} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Click Tracking</Label>
                    <p className="text-sm text-muted-foreground">Track when recipients click links.</p>
                  </div>
                  <Checkbox checked={formData.trackClicks} onCheckedChange={(c: boolean) => setFormData({...formData, trackClicks: c})} />
                </div>
              </div>

              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-semibold mb-2">Summary</h4>
                <ul className="space-y-1 text-sm">
                  <li><strong>Name:</strong> {formData.name}</li>
                  <li><strong>List:</strong> {lists?.find((l:any) => l.id === formData.emailListId)?.name || 'None'}</li>
                  <li><strong>Inboxes:</strong> {formData.inboxIds.length} selected</li>
                  <li><strong>Sequence Steps:</strong> {formData.sequences.length}</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t bg-muted/10 p-6">
          <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          
          {step < 4 ? (
            <Button onClick={() => setStep(s => Math.min(4, s + 1))} disabled={step === 1 && !formData.name}>
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save & Create'} <Save className="w-4 h-4 ml-2" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

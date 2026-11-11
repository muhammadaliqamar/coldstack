'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Flame, 
  Save, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Target, 
  Sparkles,
  Mail,
  GitBranch,
  ArrowDown,
  UserPlus,
  Workflow,
  Plus
} from 'lucide-react';

export default function NurturingPage() {
  const queryClient = useQueryClient();
  const [selectedFunnel, setSelectedFunnel] = useState<'tofu' | 'mofu' | 'bofu'>('tofu');
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [delayDays, setDelayDays] = useState(3);
  const [viewMode, setViewMode] = useState<'editor' | 'flow'>('editor');

  // Fetch all saved nurturing funnel steps
  const { data: stepList, isLoading } = useQuery({
    queryKey: ['nurturing-steps'],
    queryFn: () => fetchApi('/nurturing'),
  });

  const saveStepMutation = useMutation({
    mutationFn: (data: any) =>
      fetchApi('/nurturing', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurturing-steps'] });
      toast.success(`Step ${selectedStep} of ${selectedFunnel.toUpperCase()} saved successfully!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save funnel step');
    },
  });

  const handleStepSelect = (funnel: 'tofu' | 'mofu' | 'bofu', step: number) => {
    setSelectedStep(step);
    const existing = stepList?.find((s: any) => s.funnel === funnel && s.step === step);
    if (existing) {
      setSubject(existing.subject);
      setBodyHtml(existing.bodyHtml);
      setDelayDays(existing.delayDays);
    } else {
      setSubject('');
      setBodyHtml('');
      setDelayDays(3);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !bodyHtml) {
      toast.warning('Please enter both subject and body HTML.');
      return;
    }

    saveStepMutation.mutate({
      funnel: selectedFunnel,
      step: selectedStep,
      subject,
      bodyHtml,
      bodyText: bodyHtml.replace(/<[^>]*>/g, ''), // strip tags for text fallback
      delayDays,
    });
  };

  // Helper to count configured steps in a funnel stage
  const getConfiguredStepsCount = (funnel: string) => {
    return stepList?.filter((s: any) => s.funnel === funnel).length || 0;
  };

  const getFunnelColor = (funnel: string) => {
    if (funnel === 'tofu') return 'from-blue-600 to-indigo-600 text-blue-600 bg-blue-500/10 border-blue-500/30';
    if (funnel === 'mofu') return 'from-amber-500 to-orange-600 text-amber-600 bg-amber-500/10 border-amber-500/30';
    return 'from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-500/10 border-emerald-500/30';
  };

  const renderVisualFlow = () => {
    const activeFunnelSteps = stepList
      ?.filter((s: any) => s.funnel === selectedFunnel)
      .sort((a: any, b: any) => a.step - b.step) || [];

    return (
      <div className="space-y-8 bg-muted/20 border border-border/50 rounded-2xl p-6 md:p-10 relative overflow-hidden shadow-inner">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

        <div className="flex flex-col items-center max-w-2xl mx-auto space-y-6 relative">
          
          {/* Node 1: Entry Lead Intake Node */}
          <div className="w-full max-w-sm bg-card border border-border/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 relative group flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h4 className="font-bold text-sm text-foreground">Lead Intake Pool</h4>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">Scraped & Verified Outbound Contacts</p>
            </div>
            <Badge variant="outline" className="text-[10px] rounded-full px-2.5 py-0.5 bg-primary/5 text-primary border-primary/20">
              Active Trigger
            </Badge>
          </div>

          {/* Connection line down */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-gradient-to-b from-border to-primary/40" />
            <ArrowDown className="w-4 h-4 text-primary/40 -mt-0.5" />
          </div>

          {/* If there are no configured steps yet */}
          {activeFunnelSteps.length === 0 && (
            <div className="w-full max-w-sm border border-dashed border-border/60 p-8 rounded-2xl text-center text-muted-foreground bg-card shadow-xs">
              <Workflow className="w-10 h-10 mx-auto opacity-20 mb-3 text-muted-foreground" />
              <p className="text-xs font-semibold">No steps configured yet. Use the "Step Editor" tab to add your first email step.</p>
            </div>
          )}

          {/* Loop over configured steps */}
          {activeFunnelSteps.map((stepItem: any, idx: number) => {
            const isLast = idx === activeFunnelSteps.length - 1;
            return (
              <div key={stepItem.id} className="w-full flex flex-col items-center">
                
                {/* Visual Drip Email Node Card */}
                <div className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-lg hover:border-primary/45 transition-all duration-300 relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                  <div className="p-5 flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-xs text-primary uppercase tracking-wider">Step {stepItem.step} • Email Drip</span>
                        <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          Wait {stepItem.delayDays} days
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-foreground leading-snug break-all">
                        {stepItem.subject}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pt-1 font-semibold">
                        {stepItem.bodyHtml.replace(/<[^>]*>/g, '')}
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted/30 border-t p-3 flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                      Condition: If Previous Drip Unopened
                    </span>
                    <button 
                      onClick={() => {
                        setViewMode('editor');
                        handleStepSelect(selectedFunnel, stepItem.step);
                      }}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Edit Drip Copy
                    </button>
                  </div>
                </div>

                {/* Delay & Branch Node Line */}
                <div className="flex flex-col items-center w-full">
                  <div className="w-0.5 h-6 bg-gradient-to-b from-primary/30 to-border" />
                  
                  {/* Branch choice simulation box */}
                  <div className="flex justify-center gap-4 relative">
                    <div className="px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 font-extrabold text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      If Replied → Transition to AI Negotiation
                    </div>
                  </div>

                  {!isLast && (
                    <div className="flex flex-col items-center mt-2">
                      <div className="w-0.5 h-6 bg-border" />
                      <ArrowDown className="w-4 h-4 text-border -mt-0.5" />
                    </div>
                  )}
                </div>

              </div>
            );
          })}

          {/* End Node: Transition to BOFU closer */}
          {activeFunnelSteps.length > 0 && (
            <div className="w-full max-w-sm bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-5 rounded-2xl shadow-sm group flex items-center gap-4 bg-card">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-bold text-sm text-foreground">Bottom of Funnel AI Closer</h4>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">Automated negotiations & appointment bookings</p>
              </div>
              <Badge variant="outline" className="text-[10px] rounded-full px-2.5 py-0.5 bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                End Node
              </Badge>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Target className="w-8 h-8 text-primary" />
            Lead Nurturing Funnel Builder
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            Configure multi-stage month-long TOFU, MOFU, and BOFU email drip funnels.
          </p>
        </div>

        {/* View Mode Select Buttons */}
        <div className="bg-muted/60 border border-border/50 p-1 rounded-xl shadow-sm flex gap-1">
          <button
            onClick={() => setViewMode('editor')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === 'editor' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Step Editor
          </button>
          <button
            onClick={() => setViewMode('flow')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              viewMode === 'flow' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Visual Sequence Flow
          </button>
        </div>
      </div>

      <Tabs
        defaultValue="tofu"
        value={selectedFunnel}
        onValueChange={(val: any) => {
          setSelectedFunnel(val);
          handleStepSelect(val, 1);
        }}
        className="w-full"
      >
        <TabsList className="mb-6 bg-muted/60 p-1.5 rounded-xl border border-border/50 shadow-sm w-full sm:w-auto">
          <TabsTrigger value="tofu" className="px-6 py-2.5 font-semibold text-sm cursor-pointer">
            TOFU (Top of Funnel)
            <Badge variant="secondary" className="ml-2 bg-blue-500/10 text-blue-600 rounded-full px-2 text-xs hover:bg-blue-500/10">
              {getConfiguredStepsCount('tofu')}/10
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="mofu" className="px-6 py-2.5 font-semibold text-sm cursor-pointer">
            MOFU (Middle of Funnel)
            <Badge variant="secondary" className="ml-2 bg-amber-500/10 text-amber-600 rounded-full px-2 text-xs hover:bg-amber-500/10">
              {getConfiguredStepsCount('mofu')}/10
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="bofu" className="px-6 py-2.5 font-semibold text-sm cursor-pointer">
            BOFU (Bottom of Funnel)
            <Badge variant="secondary" className="ml-2 bg-emerald-500/10 text-emerald-600 rounded-full px-2 text-xs hover:bg-emerald-500/10">
              {getConfiguredStepsCount('bofu')}/10
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedFunnel} className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
          {viewMode === 'flow' ? (
            renderVisualFlow()
          ) : (
            <div className="grid gap-8 lg:grid-cols-4">
              {/* Steps Side Navigator */}
              <Card className="lg:col-span-1 border border-border/50 bg-card rounded-2xl shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base font-bold">Steps List</CardTitle>
                  <CardDescription className="text-xs">Click to edit each step (Max 10).</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 px-2">
                  <div className="space-y-1">
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const stepNum = idx + 1;
                      const isSaved = stepList?.some((s: any) => s.funnel === selectedFunnel && s.step === stepNum);
                      const isSelected = selectedStep === stepNum;

                      return (
                        <button
                          key={stepNum}
                          type="button"
                          onClick={() => handleStepSelect(selectedFunnel, stepNum)}
                          className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between text-sm font-semibold transition-all hover:bg-muted/40 cursor-pointer ${
                            isSelected ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary' : 'text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
                              isSelected ? 'border-primary-foreground/30 bg-primary-foreground/10' : 'bg-muted'
                            }`}>
                              {stepNum}
                            </span>
                            Step {stepNum}
                          </div>
                          {isSaved && (
                            <Badge variant="outline" className={`text-[10px] rounded-full px-2 py-0.5 border-dashed hover:bg-transparent ${
                              isSelected ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/45' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            }`}>
                              Ready
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Step Editor Content */}
              <Card className="lg:col-span-3 border border-border/50 shadow-md rounded-2xl bg-card">
                <form onSubmit={handleSave}>
                  <CardHeader className="flex flex-col sm:flex-row justify-between border-b border-border/40 pb-4 gap-4">
                    <div>
                      <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Configure {selectedFunnel.toUpperCase()} — Step {selectedStep}
                      </CardTitle>
                      <CardDescription className="text-xs">Draft high-reputation copy with smart merge variables.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Label htmlFor="delay" className="text-xs font-semibold shrink-0">Delay (Days):</Label>
                      <Input
                        id="delay"
                        type="number"
                        min="1"
                        className="w-16 rounded-lg text-center border-border/70"
                        value={delayDays}
                        onChange={(e) => setDelayDays(Number(e.target.value))}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-semibold">Email Subject</Label>
                      <Input
                        id="subject"
                        placeholder="e.g. Quick question about {{company}}"
                        className="rounded-xl border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="body" className="text-sm font-semibold flex items-center justify-between">
                        <span>Email Body (HTML/Text)</span>
                        <Badge variant="secondary" className="text-[10px] hover:bg-muted font-semibold bg-muted border border-border/40 text-muted-foreground">Spintax & Merge Tag Compliant</Badge>
                      </Label>
                      <Textarea
                        id="body"
                        placeholder="Hi {{firstName}},\n\nI noticed that you are expanding your team at {{company}}..."
                        className="min-h-[250px] rounded-xl font-mono text-sm leading-relaxed border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
                        value={bodyHtml}
                        onChange={(e) => setBodyHtml(e.target.value)}
                        required
                      />
                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="text-[9px] bg-muted px-2 py-0.5 rounded-full font-mono font-medium text-muted-foreground border border-border/30">{"{{firstName}}"}</span>
                        <span className="text-[9px] bg-muted px-2 py-0.5 rounded-full font-mono font-medium text-muted-foreground border border-border/30">{"{{company}}"}</span>
                        <span className="text-[9px] bg-muted px-2 py-0.5 rounded-full font-mono font-medium text-muted-foreground border border-border/30">{"{{title}}"}</span>
                        <span className="text-[9px] bg-muted px-2 py-0.5 rounded-full font-mono font-medium text-muted-foreground border border-border/30">{"{{firstName|\"there\"}}"}</span>
                        <span className="text-[9px] bg-muted px-2 py-0.5 rounded-full font-mono font-medium text-muted-foreground border border-border/30">{"{Hey|Hi|Hello}"}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t border-border/40 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <p className="text-xs text-muted-foreground flex items-center font-medium">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 mr-1.5 shrink-0" />
                      Drips will continue automatically until the lead replies or is booked.
                    </p>
                    <Button
                      type="submit"
                      className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl shadow-md transition-all px-6 w-full sm:w-auto cursor-pointer"
                      disabled={saveStepMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Step Config
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

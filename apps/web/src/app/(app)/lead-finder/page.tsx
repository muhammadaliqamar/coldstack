'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Flame, MapPin, Sparkles, Check, CheckCircle2, AlertTriangle, Users, Database } from 'lucide-react';

export default function LeadFinderPage() {
  const queryClient = useQueryClient();
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [source, setSource] = useState('LinkedIn B2B');
  const [listName, setListName] = useState('');
  const [scrapedLeads, setScrapedLeads] = useState<any[]>([]);

  const scrapeMutation = useMutation({
    mutationFn: (data: { industry: string; location: string; source: string }) =>
      fetchApi('/lead-finder/scrape', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      setScrapedLeads(data);
      setListName(`${industry} Leads - ${location} (${source})`);
      toast.success(`Found ${data.length} B2B leads successfully!`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Scrape failed');
    },
  });

  const importMutation = useMutation({
    mutationFn: (data: { listName: string; leads: any[] }) =>
      fetchApi('/lead-finder/import', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      toast.success(data.message || 'Leads imported and verified!');
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setScrapedLeads([]);
      setIndustry('');
      setLocation('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Import failed');
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry || !location) {
      toast.warning('Please specify both industry and location.');
      return;
    }
    scrapeMutation.mutate({ industry, location, source });
  };

  const handleImport = () => {
    if (!listName) {
      toast.warning('Please specify a contact list name.');
      return;
    }
    importMutation.mutate({ listName, leads: scrapedLeads });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
            AI B2B Lead Finder
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            Scrape, extract, and auto-verify B2B leads dynamically in seconds.
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Input Panel */}
        <Card className="md:col-span-1 border border-border/50 bg-gradient-to-br from-card to-muted/20 shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Search Parameters</CardTitle>
            <CardDescription>Enter the target industry, location & scraping source.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="source" className="text-sm font-semibold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-primary" />
                  Scraping Source
                </Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="rounded-xl border border-border/70">
                    <SelectValue placeholder="Select resource..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LinkedIn B2B">LinkedIn B2B (Executives & Directors)</SelectItem>
                    <SelectItem value="Google Maps">Google Maps (Local B2B & Retail)</SelectItem>
                    <SelectItem value="Apollo.io">Apollo.io (Startup Directories)</SelectItem>
                    <SelectItem value="Crunchbase">Crunchbase (Startups & Fundings)</SelectItem>
                    <SelectItem value="Website Crawler">Website Crawler (Domain Public Scrapes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry" className="text-sm font-semibold">Industry / Niche</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="industry"
                    placeholder="e.g. Real Estate, Software, Logistics"
                    className="pl-10 rounded-xl border border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-semibold">Location / City</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="e.g. Dubai, New York, London"
                    className="pl-10 rounded-xl border border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-md transition-all py-6 cursor-pointer"
                disabled={scrapeMutation.isPending}
              >
                {scrapeMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" />
                    Finding Leads...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-200" />
                    Find B2B Leads
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="md:col-span-2 space-y-6">
          {scrapedLeads.length > 0 ? (
            <Card className="border border-border/60 shadow-lg rounded-2xl overflow-hidden bg-card flex flex-col h-full">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4 bg-muted/20">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Scraped Prospects ({scrapedLeads.length})
                  </CardTitle>
                  <CardDescription>Review extracted B2B leads before verified import.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Contact list name..."
                    className="rounded-xl max-w-[200px]"
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                  />
                  <Button
                    onClick={handleImport}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? 'Importing...' : 'Approve & Import'}
                  </Button>
                </div>
              </CardHeader>
              <div className="flex-1 overflow-auto max-h-[500px]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 sticky top-0 text-muted-foreground font-semibold border-b">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Company</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Phone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {scrapedLeads.map((lead, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">{lead.firstName} {lead.lastName}</td>
                        <td className="px-6 py-4 text-muted-foreground">{lead.title}</td>
                        <td className="px-6 py-4 font-semibold text-foreground">{lead.company}</td>
                        <td className="px-6 py-4 font-mono text-primary/80">{lead.email}</td>
                        <td className="px-6 py-4 text-muted-foreground font-mono">{lead.phone || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card className="border-dashed border-2 flex flex-col items-center justify-center p-20 text-center bg-card/30 rounded-2xl h-full min-h-[350px] border-border/60">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                <Search className="w-8 h-8 text-muted-foreground opacity-45" />
              </div>
              <h3 className="text-xl font-bold text-foreground">No Leads Preloaded</h3>
              <p className="text-muted-foreground max-w-sm mt-2 text-sm leading-relaxed font-semibold">
                Select a Scraping Source and enter an Industry/Location to retrieve verified contacts.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

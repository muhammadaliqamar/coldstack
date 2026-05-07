'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { User, Building, Clock } from 'lucide-react';

const STAGES = [
  { id: 'new_lead', title: 'New Lead' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'opened', title: 'Opened' },
  { id: 'replied', title: 'Replied' },
  { id: 'interested', title: 'Interested' },
  { id: 'demo_scheduled', title: 'Demo' },
  { id: 'converted', title: 'Converted' },
];

function SortableLeadCard({ lead }: { lead: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: lead });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing pb-2">
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-3 space-y-2">
          <div className="flex justify-between items-start">
            <span className="font-semibold text-sm truncate pr-2">
              {lead.contact?.firstName} {lead.contact?.lastName}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{lead.campaign?.name.substring(0, 3)}</Badge>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <Building className="w-3 h-3" />
            {lead.contact?.company || 'No Company'}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(lead.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
            {lead.emailLogs?.[0]?.status === 'replied' && <Badge className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 text-[9px] px-1 h-4">Replied</Badge>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState<Record<string, any[]>>({});
  const [activeLead, setActiveLead] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => fetchApi('/leads/pipeline'),
  });

  useEffect(() => {
    if (data) setColumns(data);
  }, [data]);

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string, stage: string }) => fetchApi(`/leads/${id}`, { method: 'PUT', body: JSON.stringify({ stage }) }),
    onError: (err: any) => toast.error(err.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const handleDragStart = (event: any) => {
    setActiveLead(event.active.data.current);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    
    // Find source and destination columns
    let sourceCol = '', destCol = '';
    
    for (const [colId, items] of Object.entries(columns)) {
      if (items.find(i => i.id === activeId)) sourceCol = colId;
      if (colId === overId || items.find(i => i.id === overId)) destCol = colId;
    }

    if (!sourceCol || !destCol || sourceCol === destCol) return;

    // Optimistic UI update
    setColumns(prev => {
      const sourceItems = [...prev[sourceCol]];
      const destItems = [...prev[destCol]];
      const leadIndex = sourceItems.findIndex(i => i.id === activeId);
      const [movedLead] = sourceItems.splice(leadIndex, 1);
      movedLead.stage = destCol;
      destItems.unshift(movedLead);

      return { ...prev, [sourceCol]: sourceItems, [destCol]: destItems };
    });

    updateStageMutation.mutate({ id: activeId as string, stage: destCol });
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Sales Pipeline</h2>
        <p className="text-muted-foreground">Manage leads and track conversions.</p>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex h-full gap-4 min-w-max">
            {STAGES.map((stage) => (
              <div key={stage.id} className="w-[280px] flex flex-col bg-muted/40 rounded-lg border">
                <div className="p-3 border-b flex justify-between items-center bg-muted/50 rounded-t-lg">
                  <h3 className="font-medium text-sm">{stage.title}</h3>
                  <Badge variant="secondary" className="text-xs">{columns[stage.id]?.length || 0}</Badge>
                </div>
                
                <div className="flex-1 p-2 overflow-y-auto min-h-[150px]">
                  <SortableContext id={stage.id} items={columns[stage.id]?.map(l => l.id) || []} strategy={verticalListSortingStrategy}>
                    {columns[stage.id]?.map((lead) => (
                      <SortableLeadCard key={lead.id} lead={lead} />
                    ))}
                    {/* Invisible drop target for empty columns */}
                    {(!columns[stage.id] || columns[stage.id].length === 0) && (
                      <div className="h-full w-full rounded border-2 border-transparent" />
                    )}
                  </SortableContext>
                </div>
              </div>
            ))}
          </div>
          
          <DragOverlay>
            {activeLead ? (
              <Card className="opacity-80 rotate-2 border-primary">
                <CardContent className="p-3 space-y-2 w-[264px]">
                  <span className="font-semibold text-sm">{activeLead.contact?.firstName} {activeLead.contact?.lastName}</span>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

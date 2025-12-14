import { useTrace, TraceEvent } from '@/contexts/TraceContext';
import { X, Activity, Clock, AlertCircle, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface XRayOverlayProps {
  onClose: () => void;
}

function getPhaseIcon(phase: TraceEvent['phase']) {
  switch (phase) {
    case 'start': return <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />;
    case 'first_token': return <Activity className="h-3 w-3 text-blue-500" />;
    case 'tool_call': return <Activity className="h-3 w-3 text-purple-500" />;
    case 'complete': return <CheckCircle className="h-3 w-3 text-green-500" />;
    case 'error': return <AlertCircle className="h-3 w-3 text-red-500" />;
  }
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  const secs = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${mins}:${secs}.${ms}`;
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Derive entities dynamically from traces (DRY principle - no static list)
function deriveEntities(traces: TraceEvent[], activeEntities: Set<string>) {
  const entityMap = new Map<string, { hasError: boolean; hasComplete: boolean }>();
  
  traces.forEach(t => {
    const current = entityMap.get(t.entity) || { hasError: false, hasComplete: false };
    if (t.phase === 'error') current.hasError = true;
    if (t.phase === 'complete') current.hasComplete = true;
    entityMap.set(t.entity, current);
  });
  
  return Array.from(entityMap.entries()).map(([id, state]) => ({
    id,
    isActive: activeEntities.has(id),
    hasError: state.hasError,
    hasComplete: state.hasComplete,
  }));
}

export function XRayOverlay({ onClose }: XRayOverlayProps) {
  const { traces, activeEntities, clearTraces } = useTrace();

  // Derive entities from actual traces (no static list)
  const entities = deriveEntities(traces, activeEntities);

  // Calculate metrics
  const ttftEvents = traces.filter(t => t.phase === 'first_token');
  const completeEvents = traces.filter(t => t.phase === 'complete');
  const errorEvents = traces.filter(t => t.phase === 'error');
  
  const avgTtft = ttftEvents.length > 0
    ? Math.round(ttftEvents.reduce((sum, t) => sum + (t.duration || 0), 0) / ttftEvents.length)
    : null;
  
  const avgTtlt = completeEvents.length > 0
    ? Math.round(completeEvents.reduce((sum, t) => sum + (t.duration || 0), 0) / completeEvents.length)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">X-Ray Debugger</h2>
          <Badge variant="outline" className="text-xs">
            {traces.length} events
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearTraces}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100%-57px)]">
        {/* Left: Entity Status */}
        <div className="w-64 border-r border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Entities</h3>
          <div className="space-y-2">
            {entities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No entities traced yet</p>
            ) : (
              entities.map(entity => (
                <div 
                  key={entity.id}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md text-sm",
                    entity.isActive && "bg-yellow-500/10 border border-yellow-500/30",
                    entity.hasError && !entity.isActive && "bg-red-500/10 border border-red-500/30",
                    !entity.isActive && !entity.hasError && "bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      entity.isActive ? "bg-yellow-500 animate-pulse" : 
                      entity.hasError ? "bg-red-500" : "bg-green-500"
                    )} />
                    <span className="font-mono text-xs">{entity.id}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Metrics */}
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Metrics</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 rounded-md p-2">
                <div className="text-xs text-muted-foreground">Avg TTFT</div>
                <div className="text-lg font-mono">
                  {avgTtft !== null ? formatDuration(avgTtft) : '—'}
                </div>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <div className="text-xs text-muted-foreground">Avg TTLT</div>
                <div className="text-lg font-mono">
                  {avgTtlt !== null ? formatDuration(avgTtlt) : '—'}
                </div>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <div className="text-xs text-muted-foreground">Errors</div>
                <div className={cn("text-lg font-mono", errorEvents.length > 0 && "text-red-500")}>
                  {errorEvents.length}
                </div>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <div className="text-xs text-muted-foreground">Active</div>
                <div className="text-lg font-mono">
                  {activeEntities.size}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Event Timeline */}
        <div className="flex-1 p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Event Timeline</h3>
          <ScrollArea className="h-[calc(100%-24px)]">
            {traces.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No events yet. Interact with the app to see traces.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {[...traces].reverse().map(event => (
                  <div 
                    key={event.id}
                    className={cn(
                      "flex items-start gap-3 p-2 rounded-md text-sm font-mono",
                      event.level === 'error' && "bg-red-500/10",
                      event.phase === 'start' && "bg-yellow-500/5",
                      event.phase === 'complete' && "bg-green-500/5"
                    )}
                  >
                    {getPhaseIcon(event.phase)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          {formatTime(event.timestamp)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {event.entity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {event.phase}
                        </span>
                        {event.duration && (
                          <span className="text-xs text-primary flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(event.duration)}
                          </span>
                        )}
                      </div>
                      {event.message && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {event.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

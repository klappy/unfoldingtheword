import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface TraceEvent {
  id: string;
  timestamp: number;
  entity: string;
  phase: 'start' | 'first_token' | 'tool_call' | 'complete' | 'error';
  duration?: number;
  message?: string;
  level: 'info' | 'warn' | 'error';
  metadata?: Record<string, any>;
}

export interface EntityMetadata {
  displayName: string;
  layer: 'edge' | 'client' | 'external';
}

interface TraceContextValue {
  traces: TraceEvent[];
  activeEntities: Set<string>;
  entityMetadata: Map<string, EntityMetadata>;
  trace: (entity: string, phase: TraceEvent['phase'], message?: string, metadata?: Record<string, any>) => void;
  clearTraces: () => void;
  getEntityTraces: (entity: string) => TraceEvent[];
  startTimers: Map<string, number>;
}

const TraceContext = createContext<TraceContextValue | null>(null);

// Helper to derive active entities from counter map
function deriveActiveEntities(counters: Map<string, number>): Set<string> {
  const active = new Set<string>();
  counters.forEach((count, entity) => {
    if (count > 0) active.add(entity);
  });
  return active;
}

export function TraceProvider({ children }: { children: React.ReactNode }) {
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [entityMetadata, setEntityMetadata] = useState<Map<string, EntityMetadata>>(new Map());
  
  // Use counter map for concurrent call tracking (fixes parallel call issue)
  const activeCounters = useRef<Map<string, number>>(new Map());
  const [activeEntities, setActiveEntities] = useState<Set<string>>(new Set());
  const startTimers = useRef<Map<string, number>>(new Map());

  const trace = useCallback((
    entity: string,
    phase: TraceEvent['phase'],
    message?: string,
    metadata?: Record<string, any>
  ) => {
    const now = Date.now();
    let duration: number | undefined;

    // Capture entity metadata from first trace call (DRY - metadata lives with trace calls)
    if (metadata?.displayName && metadata?.layer) {
      setEntityMetadata(prev => {
        if (prev.has(entity)) return prev;
        const next = new Map(prev);
        next.set(entity, { displayName: metadata.displayName, layer: metadata.layer });
        return next;
      });
    }

    if (phase === 'start') {
      // Increment counter for this entity (supports parallel calls)
      const currentCount = activeCounters.current.get(entity) || 0;
      activeCounters.current.set(entity, currentCount + 1);
      startTimers.current.set(`${entity}-${now}`, now);
      setActiveEntities(deriveActiveEntities(activeCounters.current));
    } else if (phase === 'complete' || phase === 'error') {
      // Decrement counter (only mark inactive when all parallel calls complete)
      const currentCount = activeCounters.current.get(entity) || 0;
      activeCounters.current.set(entity, Math.max(0, currentCount - 1));
      
      // Find and use the oldest start timer for duration
      const timerKey = Array.from(startTimers.current.keys()).find(k => k.startsWith(entity));
      if (timerKey) {
        const startTime = startTimers.current.get(timerKey);
        if (startTime) {
          duration = now - startTime;
          startTimers.current.delete(timerKey);
        }
      }
      setActiveEntities(deriveActiveEntities(activeCounters.current));
    } else if (phase === 'first_token') {
      // Find start timer for TTFT calculation
      const timerKey = Array.from(startTimers.current.keys()).find(k => k.startsWith(entity));
      if (timerKey) {
        const startTime = startTimers.current.get(timerKey);
        if (startTime) {
          duration = now - startTime; // TTFT
        }
      }
    }

    const event: TraceEvent = {
      id: `${entity}-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      entity,
      phase,
      duration,
      message,
      level: phase === 'error' ? 'error' : 'info',
      metadata,
    };

    setTraces(prev => [...prev.slice(-99), event]); // Keep last 100 events
    
    // Also log to console for debugging
    const prefix = phase === 'error' ? '🔴' : phase === 'start' ? '🟡' : phase === 'complete' ? '🟢' : '⚪';
    console.log(`[X-Ray] ${prefix} ${entity} ${phase}${duration ? ` (${duration}ms)` : ''}${message ? `: ${message}` : ''}`);
  }, []);

  const clearTraces = useCallback(() => {
    setTraces([]);
    activeCounters.current.clear();
    setActiveEntities(new Set());
    setEntityMetadata(new Map());
    startTimers.current.clear();
  }, []);

  const getEntityTraces = useCallback((entity: string) => {
    return traces.filter(t => t.entity === entity);
  }, [traces]);

  return (
    <TraceContext.Provider value={{ 
      traces, 
      activeEntities,
      entityMetadata,
      trace, 
      clearTraces, 
      getEntityTraces,
      startTimers: startTimers.current,
    }}>
      {children}
    </TraceContext.Provider>
  );
}

export function useTrace() {
  const context = useContext(TraceContext);
  if (!context) {
    // Return no-op if not wrapped in provider (graceful degradation)
    return {
      traces: [],
      activeEntities: new Set<string>(),
      entityMetadata: new Map<string, EntityMetadata>(),
      trace: () => {},
      clearTraces: () => {},
      getEntityTraces: () => [],
      startTimers: new Map(),
    };
  }
  return context;
}

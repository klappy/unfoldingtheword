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

interface TraceContextValue {
  traces: TraceEvent[];
  activeEntities: Set<string>;
  trace: (entity: string, phase: TraceEvent['phase'], message?: string, metadata?: Record<string, any>) => void;
  clearTraces: () => void;
  getEntityTraces: (entity: string) => TraceEvent[];
  startTimers: Map<string, number>;
}

const TraceContext = createContext<TraceContextValue | null>(null);

export function TraceProvider({ children }: { children: React.ReactNode }) {
  const [traces, setTraces] = useState<TraceEvent[]>([]);
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

    if (phase === 'start') {
      startTimers.current.set(entity, now);
      setActiveEntities(prev => new Set([...prev, entity]));
    } else if (phase === 'complete' || phase === 'error') {
      const startTime = startTimers.current.get(entity);
      if (startTime) {
        duration = now - startTime;
        startTimers.current.delete(entity);
      }
      setActiveEntities(prev => {
        const next = new Set(prev);
        next.delete(entity);
        return next;
      });
    } else if (phase === 'first_token') {
      const startTime = startTimers.current.get(entity);
      if (startTime) {
        duration = now - startTime; // TTFT
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
    setActiveEntities(new Set());
    startTimers.current.clear();
  }, []);

  const getEntityTraces = useCallback((entity: string) => {
    return traces.filter(t => t.entity === entity);
  }, [traces]);

  return (
    <TraceContext.Provider value={{ 
      traces, 
      activeEntities, 
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
      trace: () => {},
      clearTraces: () => {},
      getEntityTraces: () => [],
      startTimers: new Map(),
    };
  }
  return context;
}

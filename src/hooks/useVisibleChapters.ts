import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVisibleChaptersOptions {
  rootMargin?: string;
  threshold?: number;
  bufferChapters?: number; // How many chapters to keep rendered above/below viewport
}

export function useVisibleChapters(
  totalChapters: number,
  targetChapter: number | undefined,
  options: UseVisibleChaptersOptions = {}
) {
  const {
    rootMargin = '200px 0px', // Pre-render 200px above/below viewport
    bufferChapters = 3 // Keep 3 chapters rendered above/below visible ones
  } = options;

  // Track which chapters are currently in/near viewport
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>(() => {
    // Initialize around target chapter or chapter 1
    const initial = targetChapter || 1;
    return {
      start: Math.max(1, initial - bufferChapters),
      end: Math.min(totalChapters, initial + bufferChapters + 5)
    };
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const chapterSentinels = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Update range when target chapter changes
  useEffect(() => {
    if (targetChapter) {
      setVisibleRange(prev => ({
        start: Math.max(1, Math.min(prev.start, targetChapter - bufferChapters)),
        end: Math.min(totalChapters, Math.max(prev.end, targetChapter + bufferChapters + 5))
      }));
    }
  }, [targetChapter, bufferChapters, totalChapters]);

  // Setup intersection observer
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const chapter = parseInt(entry.target.getAttribute('data-chapter') || '0');
          if (chapter === 0) return;

          if (entry.isIntersecting) {
            // Expand range to include this chapter and buffer
            setVisibleRange(prev => ({
              start: Math.max(1, Math.min(prev.start, chapter - bufferChapters)),
              end: Math.min(totalChapters, Math.max(prev.end, chapter + bufferChapters))
            }));
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin,
        threshold: 0
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [rootMargin, bufferChapters, totalChapters]);

  // Register a chapter sentinel element
  const registerSentinel = useCallback((chapter: number, element: HTMLDivElement | null) => {
    if (element) {
      chapterSentinels.current.set(chapter, element);
      observerRef.current?.observe(element);
    } else {
      const existing = chapterSentinels.current.get(chapter);
      if (existing) {
        observerRef.current?.unobserve(existing);
        chapterSentinels.current.delete(chapter);
      }
    }
  }, []);

  // Check if a chapter should be rendered
  const shouldRenderChapter = useCallback((chapter: number) => {
    return chapter >= visibleRange.start && chapter <= visibleRange.end;
  }, [visibleRange]);

  return {
    containerRef,
    registerSentinel,
    shouldRenderChapter,
    visibleRange
  };
}

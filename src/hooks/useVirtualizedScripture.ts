import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScriptureChapter, ScriptureVerse } from '@/types';

// Estimated heights for virtualization
const ESTIMATED_LINE_HEIGHT = 28; // px per line of text
const ESTIMATED_CHARS_PER_LINE = 45;
const CHAPTER_HEADER_HEIGHT = 48; // px for chapter number/play button
const CHAPTER_PADDING = 32; // py-4 top + bottom

interface VerseRenderState {
  rendered: boolean;
  height: number | null; // null = not measured yet
}

interface ChapterRenderState {
  rendered: boolean;
  estimatedHeight: number;
  measuredHeight: number | null;
  verses: Map<number, VerseRenderState>;
}

interface UseVirtualizedScriptureOptions {
  chapters: ScriptureChapter[];
  targetChapter?: number;
  targetVerse?: number;
  viewportBuffer?: number; // px above/below viewport to render
}

export function useVirtualizedScripture({
  chapters,
  targetChapter,
  targetVerse,
  viewportBuffer = 200
}: UseVirtualizedScriptureOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chapterHeightsRef = useRef<Map<number, number>>(new Map());
  const verseElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const initialScrollDone = useRef(false);

  // Track render state per chapter/verse
  const [renderState, setRenderState] = useState<Map<number, ChapterRenderState>>(() => {
    const state = new Map<number, ChapterRenderState>();
    
    chapters.forEach(ch => {
      const estimatedHeight = estimateChapterHeight(ch);
      const isTarget = ch.chapter === targetChapter;
      
      state.set(ch.chapter, {
        rendered: isTarget, // Only render target chapter initially
        estimatedHeight,
        measuredHeight: null,
        verses: new Map(
          ch.verses.map(v => [
            v.number,
            { 
              rendered: isTarget && (targetVerse ? v.number === targetVerse : true),
              height: null 
            }
          ])
        )
      });
    });
    
    return state;
  });

  // Reinitialize render state when chapters or target change (new passage/book)
  useEffect(() => {
    const state = new Map<number, ChapterRenderState>();

    chapters.forEach(ch => {
      const estimatedHeight = estimateChapterHeight(ch);
      const isTarget = ch.chapter === targetChapter;

      state.set(ch.chapter, {
        rendered: isTarget,
        estimatedHeight,
        measuredHeight: null,
        verses: new Map(
          ch.verses.map(v => [
            v.number,
            {
              rendered: isTarget && (targetVerse ? v.number === targetVerse : true),
              height: null,
            },
          ])
        ),
      });
    });

    setRenderState(state);
    initialScrollDone.current = false;
  }, [chapters, targetChapter, targetVerse]);

  // Estimate chapter height based on verse text lengths
  function estimateChapterHeight(chapter: ScriptureChapter): number {
    let totalLines = 0;
    chapter.verses.forEach(verse => {
      const lines = Math.ceil(verse.text.length / ESTIMATED_CHARS_PER_LINE);
      totalLines += Math.max(1, lines);
      if (verse.isParagraphEnd) totalLines += 0.5; // paragraph break
    });
    return CHAPTER_HEADER_HEIGHT + (totalLines * ESTIMATED_LINE_HEIGHT) + CHAPTER_PADDING;
  }

  // Estimate verse height
  function estimateVerseHeight(verse: ScriptureVerse): number {
    const lines = Math.ceil(verse.text.length / ESTIMATED_CHARS_PER_LINE);
    return Math.max(1, lines) * ESTIMATED_LINE_HEIGHT + (verse.isParagraphEnd ? ESTIMATED_LINE_HEIGHT * 0.5 : 0);
  }

  // Calculate scroll offset to a chapter
  const getChapterOffset = useCallback((chapterNum: number): number => {
    let offset = 0;
    for (const ch of chapters) {
      if (ch.chapter === chapterNum) break;
      const state = renderState.get(ch.chapter);
      offset += state?.measuredHeight ?? state?.estimatedHeight ?? 0;
    }
    return offset;
  }, [chapters, renderState]);

  // Initial scroll to target
  useEffect(() => {
    if (!containerRef.current || !targetChapter || initialScrollDone.current) return;
    
    // Immediate scroll to estimated position
    const offset = getChapterOffset(targetChapter);
    containerRef.current.scrollTop = offset;
    initialScrollDone.current = true;
    
    console.log('[Virtualized] Initial scroll to chapter', targetChapter, 'offset:', offset);
  }, [targetChapter, getChapterOffset]);

  // Setup intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const toRender: number[] = [];
        
        entries.forEach(entry => {
          const chapterNum = parseInt(entry.target.getAttribute('data-chapter') || '0');
          if (chapterNum && entry.isIntersecting) {
            toRender.push(chapterNum);
          }
        });

        if (toRender.length > 0) {
          setRenderState(prev => {
            const next = new Map(prev);
            toRender.forEach(chNum => {
              const existing = next.get(chNum);
              if (existing && !existing.rendered) {
                next.set(chNum, { ...existing, rendered: true, verses: new Map(
                  Array.from(existing.verses.entries()).map(([vNum, vs]) => [vNum, { ...vs, rendered: true }])
                )});
              }
            });
            return next;
          });
        }
      },
      {
        root: containerRef.current,
        rootMargin: `${viewportBuffer}px 0px`,
        threshold: 0
      }
    );

    return () => observerRef.current?.disconnect();
  }, [viewportBuffer]);

  // Register a chapter element with the observer
  const registerChapter = useCallback((chapterNum: number, element: HTMLElement | null) => {
    if (element) {
      observerRef.current?.observe(element);
      
      // Measure actual height once rendered
      const state = renderState.get(chapterNum);
      if (state?.rendered && !state.measuredHeight) {
        requestAnimationFrame(() => {
          const height = element.getBoundingClientRect().height;
          if (height > 0) {
            chapterHeightsRef.current.set(chapterNum, height);
            setRenderState(prev => {
              const next = new Map(prev);
              const existing = next.get(chapterNum);
              if (existing) {
                next.set(chapterNum, { ...existing, measuredHeight: height });
              }
              return next;
            });
          }
        });
      }
    } else {
      // Element removed
      const elements = containerRef.current?.querySelectorAll(`[data-chapter="${chapterNum}"]`);
      elements?.forEach(el => observerRef.current?.unobserve(el));
    }
  }, [renderState]);

  // Register a verse element for fine-grained tracking
  const registerVerse = useCallback((chapterNum: number, verseNum: number, element: HTMLElement | null) => {
    const key = `${chapterNum}:${verseNum}`;
    if (element) {
      verseElementsRef.current.set(key, element);
    } else {
      verseElementsRef.current.delete(key);
    }
  }, []);

  // Scroll to specific verse
  const scrollToVerse = useCallback((chapterNum: number, verseNum: number) => {
    const key = `${chapterNum}:${verseNum}`;
    const element = verseElementsRef.current.get(key);
    
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }
    
    // Verse not rendered yet - scroll to chapter first
    const chapterOffset = getChapterOffset(chapterNum);
    containerRef.current?.scrollTo({ top: chapterOffset, behavior: 'smooth' });
    return false;
  }, [getChapterOffset]);

  // Check if chapter should be rendered
  const shouldRenderChapter = useCallback((chapterNum: number): boolean => {
    return renderState.get(chapterNum)?.rendered ?? false;
  }, [renderState]);

  // Get height for skeleton (estimated or measured)
  const getChapterHeight = useCallback((chapterNum: number): number => {
    const state = renderState.get(chapterNum);
    return state?.measuredHeight ?? state?.estimatedHeight ?? 200;
  }, [renderState]);

  // Get total content height for proper scrollbar
  const totalHeight = useMemo(() => {
    return chapters.reduce((sum, ch) => {
      const state = renderState.get(ch.chapter);
      return sum + (state?.measuredHeight ?? state?.estimatedHeight ?? 0);
    }, 0);
  }, [chapters, renderState]);

  // Priority expand: render target chapter verses progressively
  useEffect(() => {
    if (!targetChapter) return;

    const state = renderState.get(targetChapter);
    if (!state?.rendered) return;

    // If we have a target verse, render it first, then expand outward
    if (targetVerse) {
      const chapter = chapters.find(c => c.chapter === targetChapter);
      if (!chapter) return;

      // Find target verse index
      const targetIdx = chapter.verses.findIndex(v => v.number === targetVerse);
      if (targetIdx === -1) return;

      // Progressive render: target first, then expand
      let renderQueue = [targetIdx];
      for (let i = 1; i <= chapter.verses.length; i++) {
        if (targetIdx - i >= 0) renderQueue.push(targetIdx - i);
        if (targetIdx + i < chapter.verses.length) renderQueue.push(targetIdx + i);
      }

      // Batch render using idle callback
      let idx = 0;
      const renderBatch = () => {
        if (idx >= renderQueue.length) return;
        
        const batch = renderQueue.slice(idx, idx + 5);
        idx += 5;

        setRenderState(prev => {
          const next = new Map(prev);
          const chapterState = next.get(targetChapter);
          if (chapterState) {
            const newVerses = new Map(chapterState.verses);
            batch.forEach(i => {
              const verse = chapter.verses[i];
              if (verse) {
                newVerses.set(verse.number, { rendered: true, height: null });
              }
            });
            next.set(targetChapter, { ...chapterState, verses: newVerses });
          }
          return next;
        });

        if (idx < renderQueue.length) {
          requestIdleCallback ? requestIdleCallback(renderBatch) : setTimeout(renderBatch, 0);
        }
      };

      requestIdleCallback ? requestIdleCallback(renderBatch) : setTimeout(renderBatch, 0);
    }
  }, [targetChapter, targetVerse, chapters, renderState]);

  // After target chapter renders, expand to adjacent chapters
  useEffect(() => {
    if (!targetChapter) return;

    const targetState = renderState.get(targetChapter);
    if (!targetState?.measuredHeight) return; // Wait for target to be measured

    // Queue adjacent chapters
    const adjacentChapters = [targetChapter - 1, targetChapter + 1].filter(
      ch => ch >= 1 && ch <= chapters.length && !renderState.get(ch)?.rendered
    );

    if (adjacentChapters.length > 0) {
      requestIdleCallback?.(() => {
        setRenderState(prev => {
          const next = new Map(prev);
          adjacentChapters.forEach(chNum => {
            const existing = next.get(chNum);
            if (existing && !existing.rendered) {
              next.set(chNum, { ...existing, rendered: true, verses: new Map(
                Array.from(existing.verses.entries()).map(([vNum, vs]) => [vNum, { ...vs, rendered: true }])
              )});
            }
          });
          return next;
        });
      }) ?? setTimeout(() => {
        setRenderState(prev => {
          const next = new Map(prev);
          adjacentChapters.forEach(chNum => {
            const existing = next.get(chNum);
            if (existing && !existing.rendered) {
              next.set(chNum, { ...existing, rendered: true, verses: new Map(
                Array.from(existing.verses.entries()).map(([vNum, vs]) => [vNum, { ...vs, rendered: true }])
              )});
            }
          });
          return next;
        });
      }, 0);
    }
  }, [targetChapter, chapters.length, renderState]);

  return {
    containerRef,
    registerChapter,
    registerVerse,
    shouldRenderChapter,
    getChapterHeight,
    scrollToVerse,
    totalHeight,
    estimateVerseHeight
  };
}

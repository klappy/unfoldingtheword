import { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface VerseSkeletonProps {
  estimatedLines: number;
  verseNumber?: number;
  isFirst?: boolean;
}

// Line height matching scripture-text styling
const LINE_HEIGHT = 28;

export const VerseSkeleton = memo(function VerseSkeleton({ 
  estimatedLines, 
  verseNumber,
  isFirst 
}: VerseSkeletonProps) {
  const height = Math.max(1, estimatedLines) * LINE_HEIGHT;
  
  return (
    <span 
      className="inline" 
      style={{ minHeight: height }}
    >
      {isFirst && (
        <Skeleton className="w-8 h-8 inline-block mr-1 align-top" />
      )}
      {verseNumber && (
        <Skeleton className="w-3 h-2 inline-block mr-0.5 align-super" />
      )}
      <Skeleton 
        className={cn(
          "inline-block h-4 rounded",
          estimatedLines > 2 ? "w-full" : estimatedLines > 1 ? "w-4/5" : "w-2/3"
        )} 
      />
      {estimatedLines > 1 && (
        <>
          <br />
          <Skeleton className="inline-block w-full h-4 mt-1" />
        </>
      )}
      {estimatedLines > 2 && (
        <>
          <br />
          <Skeleton className="inline-block w-3/4 h-4 mt-1" />
        </>
      )}
      {' '}
    </span>
  );
});

interface ChapterSkeletonProps {
  chapterNumber: number;
  height: number;
  verseCount?: number;
}

export const ChapterSkeleton = memo(function ChapterSkeleton({ 
  chapterNumber, 
  height,
  verseCount = 20
}: ChapterSkeletonProps) {
  return (
    <div 
      className="chapter-section py-4"
      style={{ minHeight: height }}
      data-chapter={chapterNumber}
    >
      {/* Chapter header skeleton */}
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
      
      {/* Drop cap skeleton */}
      <div className="flex items-start gap-2 mb-2">
        <Skeleton className="w-10 h-10 shrink-0" />
        <div className="flex-1 space-y-1">
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-4/5 h-4" />
        </div>
      </div>
      
      {/* Verse lines skeleton - just a few representative lines */}
      <div className="space-y-1.5">
        {Array.from({ length: Math.min(8, Math.floor(verseCount / 2)) }).map((_, i) => (
          <div key={i} className="flex gap-1 items-start">
            <Skeleton className="w-3 h-2 shrink-0 mt-1" />
            <Skeleton className={cn("h-4", i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-4/5" : "w-3/4")} />
          </div>
        ))}
      </div>
    </div>
  );
});

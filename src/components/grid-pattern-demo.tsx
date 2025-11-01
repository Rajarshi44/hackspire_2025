"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import GridPattern from '@/components/grid-pattern';

type GridPatternDemoProps = {
  bgColor?: string;
  className?: string;
  gridClassName?: string;
};

export function GridPatternDemo({
  bgColor = '#071026',
  className = '',
  gridClassName = '',
}: GridPatternDemoProps) {
  return (
    <div className={cn(`relative flex h-full w-full flex-col items-center justify-center overflow-hidden`, className)} style={{ background: bgColor }}>
      <GridPattern
        className={cn(
          "[mask-image:radial-gradient(400px_circle_at_center,white,transparent)]",
          "inset-x-0 inset-y-[-30%] h-[200%] skew-y-12 w-full",
          gridClassName
        )}
      />
    </div>
  );
}

export default GridPatternDemo;

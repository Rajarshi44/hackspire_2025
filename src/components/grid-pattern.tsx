"use client";
import React from "react";

export function GridPattern({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        {/* Coarse grid */}
        <pattern id="grid" width="42" height="32" patternUnits="userSpaceOnUse">
          <rect width="42" height="32" fill="transparent" />
          <path d="M42 0H0V32" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        </pattern>

        {/* Fine grid overlay for subtle detail */}
        <pattern id="grid-fine" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="transparent" />
          <path d="M12 0H0V12" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* draw coarse grid then fine grid on top */}
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#grid-fine)" />
    </svg>
  );
}

export default GridPattern;

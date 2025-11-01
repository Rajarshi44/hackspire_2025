"use client";
import React from "react";

export const DrawCircleText: React.FC = () => {
  return (
    <div className="mt-6 text-foreground">
      <div className="max-w-2xl">
  <h2 className="text-5xl md:text-7xl font-extrabold leading-tight">
          <div>Build</div>
          <div className="relative inline-block">
            better with{' '}
            <span className="relative inline-block px-1 z-10">
              AI-assisted
                {/* underline SVG sized to span the word width; centered and slightly wider than the word */}
                <svg viewBox="0 0 500 80" className="absolute left-1/2 -bottom-2 w-[120%] h-6 -translate-x-1/2 pointer-events-none" aria-hidden>
                  <path
                    d="M0 60 C 150 20, 350 20, 495 60"
                    stroke="#FACC15"
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="none"
                    className="animate-draw-path"
                  />
                </svg>
            </span>
          </div>
          <div>issues and workflow.</div>
        </h2>
      </div>

      <style jsx>{`
        .animate-draw-path {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          animation: draw 1.4s ease-in-out forwards;
        }

        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default DrawCircleText;

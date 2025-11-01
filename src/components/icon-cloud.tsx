"use client";
import React from "react";

export const slugs = [
  "typescript",
  "javascript",
  "dart",
  "java",
  "react",
  "flutter",
  "android",
  "html5",
  "css3",
  "nodedotjs",
  "express",
  "nextdotjs",
  "prisma",
  "amazonaws",
  "postgresql",
  "firebase",
  "nginx",
  "vercel",
  "testinglibrary",
  "jest",
  "cypress",
  "docker",
  "git",
  "jira",
  "github",
  "gitlab",
  "visualstudiocode",
  "androidstudio",
  "sonarqube",
  "figma",
];

export function IconCloud({ className = "" }: { className?: string }) {
  const images = slugs.map((slug) => `https://cdn.simpleicons.org/${slug}`);

  // static positions for a decorative cluster (top-right)
  const positions = [
    { top: 8, right: 24, size: 28, rot: -10 },
    { top: 40, right: 8, size: 36, rot: 6 },
    { top: 72, right: 48, size: 20, rot: -20 },
    { top: 16, right: 80, size: 24, rot: 12 },
    { top: 100, right: 16, size: 30, rot: -6 },
  ];

  return (
    <div className={`pointer-events-none ${className}`}>
      <div className="relative w-56 h-44">
        {positions.map((p, i) => (
          <img
            key={i}
            src={images[i % images.length]}
            alt="icon"
            className="rounded-full bg-white/10 p-1 shadow-sm absolute"
            style={{
              top: p.top,
              right: p.right,
              width: p.size,
              height: p.size,
              transform: `rotate(${p.rot}deg)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default IconCloud;

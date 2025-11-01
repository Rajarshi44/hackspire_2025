"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LoginButton } from "@/components/login-button";
import { Logo } from "@/components/logo";
import { cn } from '@/lib/utils';
import DrawCircleText from "@/components/draw-circle-text";
import GridPatternDemo from '@/components/grid-pattern-demo';

// lottie-react is a client-side library; we'll import dynamically to keep the bundle small
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function Hero() {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // Try the JSON animation first (public/assets/Chatbit.json),
    // fall back to Chatbit.lottie if present.
    const tryLoad = async () => {
      const candidates = ["/assets/Chatbit.json", "/assets/Chatbit.lottie"];
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          setAnimationData(data);
          return;
        } catch (e) {
          // ignore and try next
        }
      }
      // If none loaded, leave animationData null so we show the placeholder.
    };

    tryLoad();
    // no bubble Lottie anymore (removed per request)
  }, []);

  return (
    <section className="w-full bg-transparent relative">
      {/* Decorative GridPatternDemo background (replaces PixelBlast + GridPattern) */}
      <div className="absolute inset-0 -z-10">
        <GridPatternDemo />
      </div>

      <div className="container mx-auto px-6 py-16 min-h-screen flex items-center">
        {/* top centered logo + site name */}
        <div className="w-full flex justify-center absolute top-6 left-0">
          <Logo />
        </div>

        {/* (GitHub bubble removed) */}

        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start w-full">
          {/* Left: DrawCircleText and actions */}
          <div className="w-full md:w-2/3 text-left pr-4 md:pr-12 md:pl-8">
            <DrawCircleText />

            <div className="mt-6">
              <LoginButton />
            </div>
          </div>
          {/* keep empty right column for spacing on md */}
          <div className="hidden md:block md:w-1/3" />
        </div>
  {/* Chatbit Lottie moved to bottom-right (enlarged) */}
  <div className="absolute bottom-6 right-6 w-96 h-96 md:w-[36rem] md:h-[36rem] pointer-events-none">
          {animationData ? (
            // @ts-ignore
            <Lottie animationData={animationData} loop={true} />
          ) : (
            <div className="w-full h-full bg-surface/10 rounded-lg flex items-center justify-center">
              <span className="sr-only">Loading chatbit animation</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

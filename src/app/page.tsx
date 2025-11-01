"use client";
import React, { useEffect, useRef } from 'react';
import { LoginButton } from "@/components/login-button";
import { LogoIcon } from "@/components/logo";
import HeroSection from '@/components/hero-section';
import { TestimonialsSection } from '@/components/testimonials-section';
import Footer from '@/components/footer';

// We'll use lottie-web via CDN at runtime to avoid bundling issues.

export default function Home() {
  function AnimationFrame() {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      let cancelled = false;

      // Load lottie-web from CDN if not already present
      const ensureScript = () => {
        return new Promise<void>((resolve) => {
          if ((window as any).lottie) return resolve();
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.10.2/lottie.min.js';
          s.async = true;
          s.onload = () => resolve();
          document.head.appendChild(s);
        });
      };

      ensureScript().then(() => {
        if (cancelled) return;
        const L = (window as any).lottie;
        if (!L || !containerRef.current) return;
        const anim = L.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: '/assets/Chatbit.json',
        });

        return () => {
          anim?.destroy?.();
        };
      });

      return () => {
        cancelled = true;
      };
    }, []);

    return (
      <div className="w-full max-w-md p-4 rounded-3xl bg-gradient-to-tr from-white/5 to-white/3 shadow-xl">
        <div ref={containerRef} className="w-full h-72 md:h-[380px]" />
      </div>
    );
  }
  return (
    <div className="relative w-full bg-neutral-950">
      <div className="absolute top-0 z-[0] h-full w-full bg-neutral-900/10 bg-[radial-gradient(ellipse_20%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>

      {/* Fullscreen intro text section (two-column: left text, right animation) */}
      <section className="relative z-1 mx-auto max-w-full h-screen flex items-center">
        <div className="pointer-events-none absolute h-full w-full overflow-hidden opacity-50 [perspective:200px]">
          <div className="absolute inset-0 [transform:rotateX(35deg)]">
            <div className="animate-grid [inset:0%_0px] [margin-left:-50%] [height:300vh] [width:600vw] [transform-origin:100%_0_0] [background-image:linear-gradient(to_right,rgba(255,255,255,0.25)_1px,transparent_0),linear-gradient(to_bottom,rgba(255,255,255,0.2)_1px,transparent_0)] [background-size:120px_120px] [background-repeat:repeat]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent to-70%"></div>
        </div>






        <HeroSection />
      </section>

      {/* Fullscreen video banner section (next page) */}
      <section className="h-screen w-full flex items-center justify-center bg-black">
        <div className="relative aspect-video w-full max-w-6xl mx-auto px-6">
          <div className="relative bg-gray-800 p-6 rounded-3xl shadow-2xl border-2 border-gray-700">
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <iframe
                src="https://www.youtube.com/embed/hdAvRx74J-o?autoplay=1&mute=1&loop=1&playlist=hdAvRx74J-o"
                title="GitPulse Demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full aspect-video h-full"
              />
            </div>
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-gray-600 rounded-full"></div>
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-600 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Testimonials marquee section (full page after banner) */}
      <section className="w-full">
        <TestimonialsSection
          title="What teams say about GitPulse"
          description="Feedback from early adopters who turned chat into issues and shipped faster."
          testimonials={[
            { author: { name: 'Asha Patel', role: 'Engineering Manager', avatar: '/assets/avatar-1.jpg' }, text: 'GitPulse helped our team close issues 2x faster by surfacing the right tasks from chat.' },
            { author: { name: 'Liam O\'Connor', role: 'Frontend Lead', avatar: '/assets/avatar-2.jpg' }, text: 'The AI suggestions are shockingly accurate — reduced our triage time dramatically.' },
            { author: { name: 'Maya Johnson', role: 'DevOps', avatar: '/assets/avatar-3.jpg' }, text: 'Integration with GitHub made our standups actionable — love it.' },
          ]}
        />
      </section>

      {/* Footer (appears at the bottom of the page) */}
      <Footer />
    </div>
  );
}

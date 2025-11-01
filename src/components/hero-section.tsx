"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { LoginButton } from '@/components/login-button';
import { LogoIcon } from '@/components/logo';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export default function HeroSection() {
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/assets/Chatbit.json');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) setAnimationData(json);
      } catch (e) {
        // ignore
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // we use direct animate props to avoid strict Variants typing issues
  // keep transition simple to satisfy motion typings (avoid numeric ease array typing issues)
  const floatTransition = { duration: 4, repeat: Infinity, repeatType: 'loop' as const };

  return (
    <section className="h-screen w-full relative overflow-hidden bg-transparent">
      {/* Top center logo */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-30">
        <LogoIcon />
      </div>

      <div className="container mx-auto px-6 h-full flex items-center">
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 px-4">
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
                GitPulse — Turn conversation into action
              </h1>
              <p className="mt-6 text-lg text-slate-200">
                Your AI teammate that listens to developer chat and converts ideas into actionable GitHub issues, automations and code suggestions.
              </p>

              <div className="mt-8 flex items-center gap-4">
                <LoginButton />
                <a
                  href="#features"
                  className="hidden md:inline-flex items-center px-4 py-2 rounded-md bg-white/10 text-white hover:bg-white/20"
                >
                  Learn more
                </a>
              </div>

              <div className="mt-8 flex gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">GH</div>
                  <div>
                    <div className="text-sm text-slate-300">Repo based chatrooms</div>
                    <div className="text-xs text-slate-400">Real-time, per-repo</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Chatbit animation and floating logos */}
          <div className="md:col-span-5 flex items-center justify-center relative">
            {/* floating icons */}
            <motion.div
              className="absolute -left-8 -top-8 w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-sm text-white"
              animate={{ y: [0, -12, 0] }}
              transition={floatTransition}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 0C5.37258 0 0 5.37258 0 12C0 17.3021 3.43847 21.8 8.20508 23.3859C8.80508 23.4719 9.02539 23.1094 9.02539 22.792C9.02539 22.5039 9.01562 21.7414 9.01172 20.7793C5.67188 21.4531 4.96875 19.0742 4.96875 19.0742C4.42188 17.6797 3.63281 17.2969 3.63281 17.2969C2.54688 16.5312 3.71094 16.5469 3.71094 16.5469C4.90625 16.625 5.55469 17.7617 5.55469 17.7617C6.63281 19.5469 8.38672 19.0469 9.05859 18.7383C9.14648 17.9766 9.44531 17.4375 9.78125 17.1289C7.11719 16.8281 4.34375 15.792 4.34375 11.207C4.34375 9.91406 4.80078 8.87109 5.54297 8.07031C5.4043 7.76953 5.02344 6.53125 5.66016 4.89453C5.66016 4.89453 6.63672 4.57422 8.99609 6.12891C9.91406 5.84766 10.8984 5.70703 11.8789 5.69922C12.8594 5.70703 13.8438 5.84766 14.7656 6.12891C17.1211 4.57422 18.0977 4.89453 18.0977 4.89453C18.7344 6.53125 18.3535 7.76953 18.2148 8.07031C18.9609 8.87109 19.4102 9.91406 19.4102 11.207C19.4102 15.8086 16.6328 16.8242 13.9609 17.1211C14.3594 17.5117 14.7188 18.2773 14.7188 19.3945C14.7188 21.0117 14.7031 22.3594 14.7031 22.792C14.7031 23.1094 14.9219 23.4766 15.5312 23.3867C20.2969 21.7969 23.7344 17.3008 23.7344 12C23.7344 5.37258 18.6274 0 12 0Z" fill="white"/>
              </svg>
            </motion.div>

            <motion.div className="absolute -right-8 -bottom-8 w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-sm text-white" animate={{ y: [0, -12, 0] }} transition={floatTransition}>
              G
            </motion.div>

            <div className="w-[420px] h-[420px] md:w-[520px] md:h-[520px]">
              {animationData ? (
                // Render Lottie directly (no container wrapper around it)
                // @ts-ignore
                <Lottie animationData={animationData} loop={true} />
              ) : (
                <div className="w-full h-full bg-white/5 rounded-xl" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import Image from 'next/image';
import { Zap } from 'lucide-react';

export function Logo({ className }: { className?: string }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="relative w-10 h-10">
                <Image 
                    src="https://i.postimg.cc/bvnz3hxH/Gemini-Generated-Image-s0q3tjs0q3tjs0q3.png" 
                    alt="GitPulse Logo" 
                    fill
                    className="object-contain"
                    unoptimized
                />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <span className="text-xl font-bold tracking-tighter">GitPulse</span>
            </div>
        </div>
    );
}

export function LogoIcon({ className }: { className?: string }) {
    return (
        <div className={`p-3 bg-primary/10 rounded-full border-2 border-primary/20 ${className}`}>
            <Zap className="h-8 w-8 text-primary animate-pulse" />
        </div>
    );
}

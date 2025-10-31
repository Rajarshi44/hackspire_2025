import { Zap } from 'lucide-react';

export function Logo({ className }: { className?: string }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-6 w-6 text-primary" />
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

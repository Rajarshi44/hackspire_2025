'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, GitBranch, Zap } from "lucide-react";
import { useSidebar } from "./ui/sidebar";

export function OnboardingGuide() {
  const { isMobile, setOpenMobile } = useSidebar();

  const openSidebar = () => {
    if (isMobile) {
      setOpenMobile(true);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center h-full">
      <Card 
        className="w-full max-w-xl text-center cursor-pointer hover:border-primary/50 transition-colors duration-300"
        onClick={openSidebar}
      >
        <CardHeader>
          <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit border-2 border-primary/20 mb-4">
              <Zap className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to GitPulse!</CardTitle>
          <CardDescription>Your AI-powered collaboration hub for GitHub.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 text-center p-6 bg-card rounded-lg border border-dashed">
            <div className="flex items-center gap-4">
              <ArrowLeft className="h-8 w-8 text-primary animate-pulse hidden md:block" />
              <GitBranch className="h-8 w-8 text-primary animate-pulse md:hidden" />
              <div className="text-left">
                <h3 className="font-semibold text-lg">Select a Repository to Begin</h3>
                <p className="text-muted-foreground text-sm">
                  Choose a repository from the sidebar to start collaborating and let the AI assist you.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

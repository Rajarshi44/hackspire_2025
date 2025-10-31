import { LoginButton } from "@/components/login-button";
import { LogoIcon } from "@/components/logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground">
      <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-2xl">
        <LogoIcon />
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter bg-gradient-to-br from-primary via-primary to-accent bg-clip-text text-transparent">
          GitPulse
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-lg">
          Your AI teammate that listens to developer chat and turns ideas into actionable GitHub issues — instantly.
        </p>
        <div className="mt-4">
          <LoginButton />
        </div>
      </div>
      <div className="absolute inset-0 z-0 h-full w-full bg-[radial-gradient(circle_400px_at_50%_300px,#7f5af033,transparent)]"></div>
    </main>
  );
}

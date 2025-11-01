"use client";
import React from 'react';
import { cn } from '@/lib/utils';

export type TestimonialAuthor = {
  name: string;
  role?: string;
  avatar?: string;
  href?: string;
}

interface TestimonialCardProps {
  author: TestimonialAuthor;
  text: string;
  href?: string;
}

export function TestimonialCard({ author, text, href }: TestimonialCardProps) {
  return (
    <article className={cn("w-[320px] flex-shrink-0 rounded-2xl bg-card/60 p-4 shadow-xl border border-border/50")}>
      <div className="prose-sm text-sm text-foreground mb-3 break-words">{text}</div>

      <div className="flex items-center gap-3 mt-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 flex items-center justify-center">
          {author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.avatar} alt={author.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">{author.name.split(' ').map(n => n[0]).slice(0,2).join('')}</span>
          )}
        </div>
        <div>
          {author.href ? (
            <a href={author.href} className="text-sm font-semibold hover:underline">
              {author.name}
            </a>
          ) : (
            <div className="text-sm font-semibold">{author.name}</div>
          )}
          {author.role && <div className="text-xs text-muted-foreground">{author.role}</div>}
        </div>
      </div>
    </article>
  );
}

export default TestimonialCard;

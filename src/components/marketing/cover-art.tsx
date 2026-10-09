import Image from "next/image";
import { assets, book } from "@/config/site";
import { cn } from "@/lib/utils";

export function CoverArt({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-sm", className)}>
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-gold-400/20 via-violet-500/10 to-transparent blur-2xl"
      />
      <div className="relative rounded-2xl border border-gold-400/25 bg-charcoal p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] [transform:perspective(1200px)_rotateY(-4deg)_rotateX(1deg)]">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl">
          <Image
            src={assets.coverImage}
            alt={assets.coverImageAlt}
            fill
            priority={priority}
            sizes="(max-width: 768px) 80vw, 400px"
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs uppercase tracking-[0.2em] text-paper-dim/50">
        {book.edition} &middot; Digital Release
      </p>
    </div>
  );
}

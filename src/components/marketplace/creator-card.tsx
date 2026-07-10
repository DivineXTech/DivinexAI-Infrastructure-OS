import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface CreatorCardData {
  username: string;
  storeName: string;
  bio: string | null;
  avatarUrl: string | null;
  country: string | null;
  category: string | null;
  isVerified: boolean;
}

export function CreatorCard({ creator }: { creator: CreatorCardData }) {
  return (
    <Link
      href={`/@${creator.username}`}
      className="flex flex-col items-center rounded-lg border border-border bg-surface p-6 text-center transition-shadow hover:shadow-md"
    >
      <div className="relative h-16 w-16 overflow-hidden rounded-full bg-paper-muted">
        {creator.avatarUrl ? (
          <Image src={creator.avatarUrl} alt="" fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-lg text-ink-muted">
            {creator.storeName.charAt(0)}
          </div>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 font-medium text-ink">
        {creator.storeName}
        {creator.isVerified ? <Badge tone="teal">Verified</Badge> : null}
      </p>
      <p className="text-sm text-ink-muted">@{creator.username}</p>
      {creator.bio ? (
        <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{creator.bio}</p>
      ) : null}
      {creator.country || creator.category ? (
        <p className="mt-2 text-xs text-ink-muted">
          {[creator.category, creator.country].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </Link>
  );
}

"use client";

import { track, type AnalyticsEvent } from "@/lib/analytics";

export function TrackedLink({
  event,
  properties,
  className,
  href,
  children,
  ...rest
}: {
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => track(event, properties)}
      {...rest}
    >
      {children}
    </a>
  );
}

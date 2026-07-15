import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Every real, public, indexable route — kept in sync by hand with
 * app/(marketing)/*. Auth pages (/login, /signup) and anything under
 * /app or /admin are intentionally excluded (see robots.ts). */
const PUBLIC_ROUTES = [
  "",
  "/how-it-works",
  "/startup-kits",
  "/equipment",
  "/services",
  "/design-studio",
  "/academy",
  "/pricing",
  "/marketplace",
  "/white-label",
  "/about",
  "/contact",
  "/book-consultation",
  "/terms",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified,
  }));
}

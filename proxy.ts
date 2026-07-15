import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Proxy runs in the Edge runtime, a third context that is neither a Server
// Component nor a Client Component — importing lib/env.ts or
// lib/env.client.ts here trips their "server-only"/"client-only" guards, so
// these two public values are read directly instead.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Next.js 16 renamed Middleware to Proxy (same runtime, same file
 * conventions). This handles two jobs only:
 *  1. Refreshing the Supabase session cookie on every request.
 *  2. An optimistic redirect for signed-out visitors to `/app/*` and
 *     `/admin/*`.
 * This is NOT the authorization boundary — role/tenant checks happen
 * server-side in `lib/auth/session.ts` on every protected route, per
 * Next.js's own guidance that Proxy must not be the sole auth mechanism.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/app") ||
    request.nextUrl.pathname.startsWith("/admin");

  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Skip static assets and image optimization requests.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabasePublicEnv } from "./env";
import { LOGIN_PATH, isPublicPath } from "@/lib/auth/redirect";

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * anonymous visitors to the login page.
 *
 * This is only a first gate for UX: every page and Server Action still checks
 * the user and role itself (lib/auth/session.ts), and RLS protects the data.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-control headers that prevent CDNs from caching auth cookies
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it triggers
  // the token refresh that keeps the user signed in.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isSignedIn && !isPublicPath(pathname)) {
    return redirectKeepingCookies(request, response, LOGIN_PATH, {
      next: pathname + search,
    });
  }

  if (isSignedIn && pathname === LOGIN_PATH) {
    return redirectKeepingCookies(request, response, "/");
  }

  return response;
}

function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
  params: Record<string, string> = {},
) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "/") target.searchParams.set(key, value);
  }
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

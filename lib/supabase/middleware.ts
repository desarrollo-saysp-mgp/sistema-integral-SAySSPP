import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it so the
  // middleware does not refresh the user's session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes - allow access
  const isPublicRoute =
    pathname.startsWith("/login") || pathname.startsWith("/reset-password");

  // Protected routes
  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isProtectedRoute = isAdminRoute || isDashboardRoute;

  // If accessing protected route without authentication, redirect to login
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    const response = NextResponse.redirect(redirectUrl);
    // Copy cookies from supabaseResponse to maintain session
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
    return response;
  }

  // If authenticated and accessing admin route, check role
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    // Redirect non-admin users to dashboard
    if (!profile || profile.role !== "Admin") {
      const response = NextResponse.redirect(
        new URL("/dashboard", request.url),
      );
      // Copy cookies from supabaseResponse to maintain session
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie);
      });
      return response;
    }
  }

  // If authenticated and trying to access login page, redirect to dashboard
  if (isPublicRoute && user && pathname === "/login") {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    // Copy cookies from supabaseResponse to maintain session
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
    return response;
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next()
  // make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.set(supabaseResponse.cookies)
  return supabaseResponse;
}

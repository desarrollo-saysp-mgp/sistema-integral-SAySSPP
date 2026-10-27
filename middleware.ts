
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // El login y recuperación de contraseña son páginas públicas.
  // No necesitan verificar previamente una sesión.
  if (
    pathname === "/login" ||
    pathname.startsWith("/reset-password")
  ) {
    return NextResponse.next();
  }

  // Barrido conserva su propia verificación de identidad
  // y permisos dentro de records/route.ts.
  if (pathname === "/api/test-sweeping/records") {
    return NextResponse.next();
  }

  // Resto del sistema: protección original.
  return updateSession(request);
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

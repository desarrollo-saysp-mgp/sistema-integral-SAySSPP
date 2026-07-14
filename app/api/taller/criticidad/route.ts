import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const canAccessTaller = (profile: {
  role: string;
  modules: string[] | null;
}) => {
  const role = normalizeText(profile.role);

  return (
    role === "admin" ||
    role === "adminlectura" ||
    role === "taller" ||
    profile.modules?.includes("work_orders")
  );
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role, modules")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !canAccessTaller(profile)) {
      return NextResponse.json(
        { error: "No autorizado para ver criticidad vehicular" },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("vehicle_criticality_settings")
      .select(
        "id, vehicle_code, vehicle, license_plate, service_criticality, replacement_score, security_score, notes, created_at, updated_at",
      )
      .order("vehicle_code", { ascending: true });

    if (error) {
      console.error("Error fetching vehicle criticality:", error);
      return NextResponse.json(
        { error: "Error al cargar criticidad vehicular" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/taller/criticidad:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

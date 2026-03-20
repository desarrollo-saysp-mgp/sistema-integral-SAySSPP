import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { id } = await context.params;
    const complaintId = parseInt(id);

    if (Number.isNaN(complaintId)) {
      return NextResponse.json(
        { error: "ID de reclamo inválido" },
        { status: 400 },
      );
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: "No se pudo validar el usuario" },
        { status: 500 },
      );
    }

    if (currentUser.role !== "Admin") {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 },
      );
    }

    const { data, error } = await supabase
      .from("complaint_history")
      .select(
        `
        *,
        user:users!changed_by(full_name)
      `,
      )
      .eq("complaint_id", complaintId)
      .order("changed_at", { ascending: false });

    if (error) {
      console.error("Error fetching complaint history:", error);
      return NextResponse.json(
        { error: "Error cargando historial" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/complaints/[id]/history:",
      error,
    );
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
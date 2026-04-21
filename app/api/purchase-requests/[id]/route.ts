import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();

    const parsedAmount =
      typeof body.amount === "number"
        ? body.amount
        : Number(String(body.amount || "").replace(/\./g, "").replace(",", "."));

    const { data, error } = await supabase
      .from("purchase_requests")
      .update({
        fc_date: body.fc_date || null,
        fc_number: body.fc_number || null,
        supplier_name: body.supplier_name || null,
        cuit: body.cuit || null,
        dependency: body.dependency || null,
        expense_type: body.expense_type || null,
        code: body.code || null,
        affectation: body.affectation || null,
        amount: Number.isNaN(parsedAmount) ? null : parsedAmount,
        invoice_date: body.invoice_date || null,
        invoice_number: body.invoice_number || null,
        detail: body.detail || null,
        memo: body.memo || null,
        extra_data: body.extra_data || {},
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating purchase request:", error);
      return NextResponse.json({ error: "Error al actualizar FC" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/purchase-requests/[id]:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { error } = await supabase
      .from("purchase_requests")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting purchase request:", error);
      return NextResponse.json({ error: "Error al eliminar FC" }, { status: 500 });
    }

    return NextResponse.json({ message: "FC eliminado correctamente" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/purchase-requests/[id]:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
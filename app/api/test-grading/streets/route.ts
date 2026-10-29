import { NextRequest, NextResponse } from "next/server";
import { getGradingAccess } from "../_access";




export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json([]);
    }

    const access = await getGradingAccess();
    if (!access.authenticated) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (!access.canView) {
      return NextResponse.json({ error: "Sin permiso para ver Motonivelación." }, { status: 403 });
    }
    const supabase = access.supabase;

    const { data, error } = await supabase.rpc(
      "test_autocomplete_streets",
      {
        p_query: q,
        p_limit: 20,
      }
    );

    if (error) {
      console.error(
        "Error buscando calles para autocomplete:",
        error
      );

      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error(
      "Error interno buscando calles:",
      error
    );

    return NextResponse.json(
      {
        error: "Error interno buscando calles.",
      },
      {
        status: 500,
      }
    );
  }
}
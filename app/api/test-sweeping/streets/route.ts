import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json([]);
    }

    const supabase = await createClient();

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
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const street = searchParams.get("street");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!street || !from || !to) {
      return NextResponse.json(
        {
          error:
            "Faltan los parámetros street, from o to.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "test_get_street_segment",
      {
        p_main_street: street,
        p_from_street: from,
        p_to_street: to,
      }
    );

    if (error) {
      console.error(
        "Error obteniendo tramo de barrido:",
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

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Error interno obteniendo el tramo.",
      },
      {
        status: 500,
      }
    );
  }
}
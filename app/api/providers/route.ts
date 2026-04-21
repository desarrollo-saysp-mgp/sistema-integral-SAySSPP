import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalizeCuit(value: string) {
  return value.replace(/\D/g, "").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchProviderNameFromExternalSource(cuit: string) {
  try {
    const response = await fetch(`https://www.cuitonline.com/search/${cuit}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    const match = html.match(
      /<h2[^>]*class="denominacion"[^>]*>(.*?)<\/h2>/i,
    );

    if (!match?.[1]) {
      return null;
    }

    const providerName = decodeHtmlEntities(match[1]).trim();

    return providerName || null;
  } catch (error) {
    console.error("Error fetching provider from external source:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const rawCuit = request.nextUrl.searchParams.get("cuit");

    if (!rawCuit) {
      const { data, error } = await supabase
        .from("providers")
        .select("id, cuit, name")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching providers:", error);
        return NextResponse.json(
          { error: "Error al cargar proveedores" },
          { status: 500 },
        );
      }

      return NextResponse.json({ data: data || [] });
    }

    const cuit = normalizeCuit(rawCuit);

    if (cuit.length !== 11) {
      return NextResponse.json({ error: "CUIT inválido" }, { status: 400 });
    }

    const { data: provider, error } = await supabase
      .from("providers")
      .select("id, cuit, name")
      .eq("cuit", cuit)
      .maybeSingle();

    if (error) {
      console.error("Error fetching provider from database:", error);
      return NextResponse.json(
        { error: "Error al buscar proveedor" },
        { status: 500 },
      );
    }

    if (provider) {
      return NextResponse.json({
        data: provider,
        source: "database",
      });
    }

    const externalName = await fetchProviderNameFromExternalSource(cuit);

    if (!externalName) {
      return NextResponse.json({
        data: null,
        source: "external",
      });
    }

    return NextResponse.json({
      data: {
        id: `external-${cuit}`,
        cuit,
        name: externalName,
      },
      source: "external",
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/providers:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_SECTORS = [
  "ana",
  "arbolado",
  "secretaria",
  "suministros",
  "zv",
  "sp",
  "girsu",
] as const;

type ValidSector = (typeof VALID_SECTORS)[number];

function isValidSector(value: string): value is ValidSector {
  return VALID_SECTORS.includes(value as ValidSector);
}

function applyTableFilters(
  query: any,
  {
    sector,
    cuit,
    supplier,
    expenseType,
    month,
  }: {
    sector: string | null;
    cuit: string | null;
    supplier: string | null;
    expenseType: string | null;
    month: string | null;
  },
) {
  if (sector) {
    query = query.eq("sector", sector);
  }

  if (cuit && cuit.trim() !== "") {
    query = query.ilike("cuit", `%${cuit.trim()}%`);
  }

  if (supplier && supplier.trim() !== "") {
    query = query.ilike("supplier_name", `%${supplier.trim()}%`);
  }

  if (expenseType && expenseType !== "") {
    query = query.eq("expense_type", expenseType);
  }

  // Filtro por mes de factura
  if (month && month !== "") {
    const [year, monthNumber] = month.split("-");

    const startDate = `${year}-${monthNumber}-01`;

    const nextMonth =
      Number(monthNumber) === 12
        ? `${Number(year) + 1}-01`
        : `${year}-${String(Number(monthNumber) + 1).padStart(2, "0")}`;

    const endDate = `${nextMonth}-01`;

    query = query
      .gte("invoice_date", startDate)
      .lt("invoice_date", endDate);
  }

  return query;
}

function applyCardMonthFilter(
  query: any,
  cardMonth: string | null,
) {
  if (!cardMonth || cardMonth.trim() === "") return query;

  const [year, monthNumber] = cardMonth.split("-");

  const startDate = `${year}-${monthNumber}-01`;

  const nextMonth =
    Number(monthNumber) === 12
      ? `${Number(year) + 1}-01`
      : `${year}-${String(Number(monthNumber) + 1).padStart(2, "0")}`;

  const endDate = `${nextMonth}-01`;

  return query
    .gte("invoice_date", startDate)
    .lt("invoice_date", endDate);
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

    const { data: profile } = await supabase
      .from("users")
      .select("modules, fc_sectors")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    const modules = Array.isArray(profile.modules) ? profile.modules : [];
    const fcSectors = Array.isArray(profile.fc_sectors)
      ? profile.fc_sectors
      : [];

    if (!modules.includes("purchase_requests")) {
      return NextResponse.json({ error: "Sin acceso a FC" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;

    const sector = searchParams.get("sector");
    const cuit = searchParams.get("cuit");
    const supplier = searchParams.get("supplier");
    const expenseType = searchParams.get("expense_type");
    const month = searchParams.get("month"); // tabla
    const cardMonth = searchParams.get("card_month"); // tarjetas
    const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "20");

    if (sector) {
      if (!isValidSector(sector)) {
        return NextResponse.json({ error: "Sector inválido" }, { status: 400 });
      }

      const canAccessSector =
        fcSectors.includes("all") || fcSectors.includes(sector);

      if (!canAccessSector) {
        return NextResponse.json(
          { error: "Sin acceso a este sector" },
          { status: 403 },
        );
      }
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // =========================
    // TABLA
    // =========================
    let listQuery = supabase
      .from("purchase_requests")
      .select("*", { count: "exact" });

    if (!sector && !fcSectors.includes("all")) {
      listQuery = listQuery.in("sector", fcSectors);
    }

    listQuery = applyTableFilters(listQuery, {
      sector,
      cuit,
      supplier,
      expenseType,
      month,
    });

    listQuery = listQuery
      .order("invoice_date", { ascending: sort === "asc", nullsFirst: false })
      .order("fc_date", { ascending: sort === "asc", nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, error, count } = await listQuery;

    if (error) {
      console.error("Error fetching purchase requests:", error);
      return NextResponse.json(
        { error: "Error al cargar formularios de compra" },
        { status: 500 },
      );
    }

    // =========================
    // TARJETAS
    // =========================
    let totalsQuery = supabase
      .from("purchase_requests")
      .select("expense_type, amount");

    if (!sector && !fcSectors.includes("all")) {
      totalsQuery = totalsQuery.in("sector", fcSectors);
    }

    if (sector) {
      totalsQuery = totalsQuery.eq("sector", sector);
    }

    totalsQuery = applyCardMonthFilter(totalsQuery, cardMonth);

    const { data: totalsData, error: totalsError } = await totalsQuery;

    if (totalsError) {
      console.error("Error fetching totals:", totalsError);
      return NextResponse.json(
        { error: "Error al calcular totales" },
        { status: 500 },
      );
    }

    const totals: Record<string, number> = {
      "32": 0,
      "21": 0,
      "51": 0,
    };

    for (const row of totalsData || []) {
      const expenseTypeValue = String(row.expense_type || "");
      const amountValue = Number(row.amount || 0);

      if (totals[expenseTypeValue] !== undefined) {
        totals[expenseTypeValue] += amountValue;
      }
    }

    return NextResponse.json({
      data: data || [],
      totals,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/purchase-requests:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("modules, fc_sectors")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    const modules = Array.isArray(profile.modules) ? profile.modules : [];
    const fcSectors = Array.isArray(profile.fc_sectors)
      ? profile.fc_sectors
      : [];

    if (!modules.includes("purchase_requests")) {
      return NextResponse.json({ error: "Sin acceso a FC" }, { status: 403 });
    }

    const body = await request.json();

    const {
      sector,
      form_variant,
      fc_date,
      fc_number,
      supplier_name,
      cuit,
      dependency,
      expense_type,
      code,
      affectation,
      amount,
      invoice_date,
      invoice_number,
      concept,
      detail,
      memo,
      extra_data,
    } = body;

    if (!sector || !isValidSector(sector)) {
      return NextResponse.json({ error: "Sector inválido" }, { status: 400 });
    }

    const canAccessSector =
      fcSectors.includes("all") || fcSectors.includes(sector);

    if (!canAccessSector) {
      return NextResponse.json(
        { error: "Sin acceso a este sector" },
        { status: 403 },
      );
    }

    if (!fc_date || !fc_number || !supplier_name || !amount) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    const parsedAmount =
      typeof amount === "number"
        ? amount
        : Number(String(amount).replace(/\./g, "").replace(",", "."));

    if (Number.isNaN(parsedAmount)) {
      return NextResponse.json({ error: "Importe inválido" }, { status: 400 });
    }

    const normalizedCuit = typeof cuit === "string" ? cuit.trim() : "";
    const normalizedSupplierName =
      typeof supplier_name === "string" ? supplier_name.trim() : "";

    if (normalizedCuit && normalizedSupplierName) {
      const { data: existingProvider } = await supabase
        .from("providers")
        .select("id")
        .eq("cuit", normalizedCuit)
        .maybeSingle();

      if (!existingProvider) {
        const { error: providerInsertError } = await supabase
          .from("providers")
          .insert({
            cuit: normalizedCuit,
            name: normalizedSupplierName,
          });

        if (providerInsertError) {
          console.error("Error saving provider:", providerInsertError);
        }
      }
    }

    const finalDependency = sector === "arbolado" ? "53" : dependency || null;

    const { data, error } = await supabase
      .from("purchase_requests")
      .insert({
        sector,
        form_variant: form_variant || "standard",
        fc_date,
        fc_number,
        supplier_name: normalizedSupplierName || null,
        cuit: normalizedCuit || null,
        dependency: finalDependency,
        expense_type: expense_type || null,
        code: code || null,
        affectation: affectation || null,
        amount: parsedAmount,
        invoice_date: invoice_date || null,
        invoice_number: invoice_number || null,
        concept: concept || null,
        detail: detail || null,
        memo: memo || null,
        extra_data: extra_data || {},
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error creating purchase request:", error);
      return NextResponse.json(
        { error: "Error al crear formulario de compra" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data, message: "Formulario creado exitosamente" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/purchase-requests:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
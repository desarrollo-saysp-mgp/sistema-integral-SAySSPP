import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ComplaintInsert } from "@/types";
import { obtenerLatLon } from "@/lib/geocoding";

// Validation helper functions
const validatePhone = (phone: string): boolean => {
  if (!phone || !phone.trim()) return true;
  const digitsOnly = /^\d+$/;
  return digitsOnly.test(phone.trim()) && phone.trim().length <= 50;
};

const validateEmail = (email: string): boolean => {
  if (!email || !email.trim()) return true;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim()) && email.trim().length <= 100;
};

const validSinceWhenValues = [
  "En el día",
  "1 semana",
  "1 mes",
  "3 meses",
  "6 meses",
  "1 año",
];

const validContactMethods = ["Presencial", "Telefono", "Email", "WhatsApp"];
const validStatuses = ["En proceso", "Resuelto", "No resuelto"];
const validArboladoLevels = ["Urgente", "Importante", "Orden de llegada"];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const service_id = searchParams.get("service_id");
    const date_from = searchParams.get("date_from");
    const date_to = searchParams.get("date_to");
    const form_variant = searchParams.get("form_variant");

    const pageSize = 1000;
    let from = 0;
    let allComplaints: any[] = [];

    while (true) {
      let query = supabase
        .from("complaints")
        .select(
          `
          *,
          service:services(id, name),
          cause:causes(id, name),
          loaded_by_user:users!loaded_by(id, full_name)
        `,
        )
        .order("complaint_number", { ascending: false });

      // 🔒 Restricción automática por rol
      if (currentUser.role === "ReclamosArbolado") {
        query = query.eq("form_variant", "arbolado");
      }

      if (currentUser.role === "Reclamos") {
        query = query.or("form_variant.eq.general,form_variant.is.null");
      }

      // Filtros manuales
      if (search) {
        query = query.ilike("complainant_name", `%${search}%`);
      }

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      if (service_id && service_id !== "all") {
        query = query.eq("service_id", parseInt(service_id));
      }

      if (date_from) {
        query = query.gte("complaint_date", date_from);
      }

      if (date_to) {
        query = query.lte("complaint_date", date_to);
      }

      // Solo para admin / admin lectura permitimos sobreescribir por query
      if (
        form_variant &&
        form_variant !== "all" &&
        (currentUser.role === "Admin" || currentUser.role === "AdminLectura")
      ) {
        query = query.eq("form_variant", form_variant);
      }

      const { data, error } = await query.range(from, from + pageSize - 1);

      if (error) {
        console.error("Error fetching complaints:", error);
        return NextResponse.json(
          { error: "Error al cargar reclamos" },
          { status: 500 },
        );
      }

      if (!data || data.length === 0) {
        break;
      }

      allComplaints = [...allComplaints, ...data];

      if (data.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return NextResponse.json({ data: allComplaints });
  } catch (error) {
    console.error("Unexpected error in GET /api/complaints:", error);
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

    if (currentUser.role === "AdminLectura") {
      return NextResponse.json(
        { error: "No autorizado. Usuario en modo solo lectura" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const formVariant = body.form_variant || "general";

    if (!["general", "arbolado"].includes(formVariant)) {
      return NextResponse.json(
        { error: "Variante de formulario inválida" },
        { status: 400 },
      );
    }

    if (formVariant === "general") {
      const requiredFields = [
        "complainant_name",
        "address",
        "street_number",
        "service_id",
        "cause_id",
        "zone",
        "since_when",
        "contact_method",
        "details",
      ];

      for (const field of requiredFields) {
        if (!body[field] || !String(body[field]).trim()) {
          return NextResponse.json(
            { error: `El campo ${field} es requerido` },
            { status: 400 },
          );
        }
      }

      if (!validContactMethods.includes(body.contact_method)) {
        return NextResponse.json(
          { error: "Método de contacto inválido" },
          { status: 400 },
        );
      }

      if (!validSinceWhenValues.includes(body.since_when)) {
        return NextResponse.json(
          { error: "Valor de 'Desde cuándo' inválido" },
          { status: 400 },
        );
      }
    }

    if (formVariant === "arbolado") {
      const requiredFields = [
        "complaint_date",
        "department",
        "level",
        "description_type",
        "status",
      ];

      for (const field of requiredFields) {
        if (!body[field] || !String(body[field]).trim()) {
          return NextResponse.json(
            { error: `El campo ${field} es requerido` },
            { status: 400 },
          );
        }
      }

      if (!validArboladoLevels.includes(body.level)) {
        return NextResponse.json(
          { error: "Nivel inválido para Arbolado" },
          { status: 400 },
        );
      }

      if (
        body.contact_method &&
        !validContactMethods.includes(body.contact_method)
      ) {
        return NextResponse.json(
          { error: "Método de contacto inválido" },
          { status: 400 },
        );
      }
    }

    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: "Estado inválido" },
        { status: 400 },
      );
    }

    if (body.phone_number && !validatePhone(body.phone_number)) {
      return NextResponse.json(
        {
          error:
            "Formato de teléfono inválido. Solo números, máximo 50 caracteres",
        },
        { status: 400 },
      );
    }

    if (body.email && !validateEmail(body.email)) {
      return NextResponse.json(
        { error: "Formato de email inválido" },
        { status: 400 },
      );
    }

    const latlon =
      body.address && body.street_number
        ? await obtenerLatLon(body.address, body.street_number)
        : null;

    let complaintData: ComplaintInsert = {
      complainant_name: body.complainant_name?.trim() || null,
      address: body.address?.trim() || null,
      street_number: body.street_number?.trim() || null,
      dni: body.dni?.trim() || null,
      phone_number: body.phone_number?.trim() || null,
      email: body.email?.trim() || null,
      status: body.status || "En proceso",
      referred: body.referred || false,
      loaded_by: authUser.id,
      complaint_date:
        body.complaint_date || new Date().toISOString().split("T")[0],
      latlon,
      form_variant: formVariant,
      extra_data: null,
    };

    if (formVariant === "general") {
      complaintData = {
        ...complaintData,
        service_id: parseInt(body.service_id),
        cause_id: parseInt(body.cause_id),
        zone: body.zone.trim(),
        since_when: body.since_when,
        contact_method: body.contact_method,
        details: body.details.trim(),
      };
    }

    if (formVariant === "arbolado") {
      complaintData = {
        ...complaintData,
        details: body.description_type?.trim() || null,
        contact_method: body.contact_method?.trim() || null,
        extra_data: {
          department: body.department?.trim() || "Arbolado",
          level: body.level?.trim() || null,
          description_type: body.description_type?.trim() || null,
          observations: body.observations?.trim() || null,
          solution: body.solution?.trim() || null,
          resolution_date: body.resolution_date || null,
          agent: body.agent?.trim() || null,
          resolution_responsible:
            body.resolution_responsible?.trim() || null,
        },
      };
    }

    const { data: complaint, error } = await supabase
      .from("complaints")
      .insert(complaintData)
      .select(
        `
        *,
        service:services(id, name),
        cause:causes(id, name),
        loaded_by_user:users!loaded_by(id, full_name)
      `,
      )
      .single();

    if (error) {
      console.error("Error creating complaint:", error);
      return NextResponse.json(
        { error: "Error al crear reclamo" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: complaint, message: "Reclamo creado exitosamente" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/complaints:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
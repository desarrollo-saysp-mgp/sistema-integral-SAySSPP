import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerDatosEncuesta, type KoboRespuesta } from "@/lib/kobo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Registro = Record<string, unknown>;

type Pregunta = {
  nombre: string;
  campo: string;
  etiqueta: string;
  tipo: string;
  opciones: { valor: string; etiqueta: string }[];
  orden: number;
  historica: boolean;
};

const METADATOS = new Set([
  "_id", "_uuid", "_index", "_status", "_version_", "_submission_time",
  "_validation_status", "_submitted_by", "_attachments", "_geolocation",
  "_tags", "_notes", "_xform_id_string", "_media_all_received",
  "_duration", "_total_media", "formhub/uuid", "meta/instanceID",
  "start", "end", "today", "__version__",
]);

const TIPOS_TECNICOS = new Set([
  "start", "end", "today", "deviceid", "username", "subscriberid",
  "simserial", "phonenumber", "note", "calculate", "hidden", "audit",
]);

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function obtenerEtiqueta(valor: unknown, respaldo: string): string {
  if (typeof valor === "string") return valor.trim() || respaldo;
  if (Array.isArray(valor)) {
    const primera = valor.find((item) => typeof item === "string" && item.trim());
    if (typeof primera === "string") return primera;
  }
  if (esRegistro(valor)) {
    const primera = Object.values(valor).find(
      (item) => typeof item === "string" && item.trim()
    );
    if (typeof primera === "string") return primera;
  }
  return respaldo;
}

function normalizarTexto(valor: string): string {
  return valor.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function obtenerPreguntas(formulario: Registro): Pregunta[] {
  const contenido = esRegistro(formulario.content) ? formulario.content : {};
  const encuesta = Array.isArray(contenido.survey) ? contenido.survey : [];
  const choices = Array.isArray(contenido.choices) ? contenido.choices : [];
  const preguntas: Pregunta[] = [];

  function recorrer(elementos: unknown[], ruta: string[] = []) {
    const rutaActual = [...ruta];
    for (const elemento of elementos) {
      if (!esRegistro(elemento)) continue;
      const nombre = typeof elemento.name === "string" ? elemento.name : "";
      const tipo = typeof elemento.type === "string" ? elemento.type : "desconocido";

      if (tipo === "begin_group" || tipo === "begin_repeat") {
        if (nombre) rutaActual.push(nombre);
        continue;
      }
      if (tipo === "end_group" || tipo === "end_repeat") {
        rutaActual.pop();
        continue;
      }
      if (Array.isArray(elemento.children)) {
        recorrer(elemento.children, nombre ? [...rutaActual, nombre] : rutaActual);
        continue;
      }
      if (!nombre || TIPOS_TECNICOS.has(tipo)) continue;

      const campo = [...rutaActual, nombre].join("/");
      const lista = typeof elemento.select_from_list_name === "string"
        ? elemento.select_from_list_name
        : typeof elemento.list_name === "string" ? elemento.list_name : "";
      const opciones = choices
        .filter((item) => esRegistro(item) && item.list_name === lista && lista !== "")
        .map((item) => {
          const opcion = item as Registro;
          const valor = String(opcion.name ?? "");
          return { valor, etiqueta: obtenerEtiqueta(opcion.label, normalizarTexto(valor)) };
        })
        .filter((item) => item.valor !== "");

      preguntas.push({
        nombre, campo,
        etiqueta: obtenerEtiqueta(elemento.label, normalizarTexto(nombre)),
        tipo, opciones, orden: preguntas.length, historica: false,
      });
    }
  }

  recorrer(encuesta);
  return preguntas;
}

function detectarCamposHistoricos(respuestas: KoboRespuesta[], preguntas: Pregunta[]): Pregunta[] {
  const conocidos = new Set(preguntas.flatMap((p) => [p.campo, p.nombre]));
  const encontrados = new Set<string>();
  for (const respuesta of respuestas) {
    for (const campo of Object.keys(respuesta)) {
      // El formulario actual es la fuente de verdad de las preguntas.
      // Los campos históricos que puedan contener datos personales no se publican.
      if (conocidos.has(campo) || METADATOS.has(campo)) continue;
      if (campo.startsWith("_") || campo.startsWith("meta/") ||
          campo.startsWith("formhub/") || campo.startsWith("__")) continue;
      if (/^(calle|n.mero.de.casa|direcci.n|domicilio|dni|tel.fono|email|correo)$/i.test(campo)) continue;
      encontrados.add(campo);
    }
  }
  // Para no exponer nombres, direcciones ni texto libre sin conocer el tipo,
  // no publicamos estadísticas de campos históricos desconocidos.
  // Se recuperarán mediante metadatos de versiones anteriores en una etapa posterior.
  void encontrados;
  return [];
}

function leerValor(respuesta: KoboRespuesta, pregunta: Pregunta): unknown {
  if (Object.prototype.hasOwnProperty.call(respuesta, pregunta.campo)) {
    return respuesta[pregunta.campo];
  }
  if (pregunta.campo !== pregunta.nombre) return respuesta[pregunta.nombre];
  return undefined;
}

function tieneRespuesta(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === "string") return valor.trim() !== "";
  return typeof valor === "number" || typeof valor === "boolean";
}

function generarEstadistica(pregunta: Pregunta, respuestas: KoboRespuesta[]) {
  const valores = respuestas.map((respuesta) => leerValor(respuesta, pregunta)).filter(tieneRespuesta);
  const respondidas = valores.length;
  const sinRespuesta = respuestas.length - respondidas;
  const esSeleccion = pregunta.tipo.startsWith("select_one") || pregunta.tipo.startsWith("select_multiple");
  const esNumerica = ["integer", "decimal", "range"].includes(pregunta.tipo);
  const frecuencias = new Map<string, number>();

  if (esSeleccion) {
    for (const valor of valores) {
      const opciones = pregunta.tipo.startsWith("select_multiple")
        ? String(valor).trim().split(/\s+/)
        : [String(valor)];
      for (const opcion of new Set(opciones)) {
        if (!opcion) continue;
        frecuencias.set(opcion, (frecuencias.get(opcion) ?? 0) + 1);
      }
    }
  }

  const mapaEtiquetas = new Map(pregunta.opciones.map((opcion) => [opcion.valor, opcion.etiqueta]));
  const distribucion = [...frecuencias.entries()]
    .map(([valor, cantidad]) => ({
      valor,
      etiqueta: mapaEtiquetas.get(valor) ?? normalizarTexto(valor),
      cantidad,
      porcentaje: respondidas ? Number(((cantidad / respondidas) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const numeros = esNumerica
    ? valores.map((v) => typeof v === "number" || typeof v === "string" ? Number(v) : NaN)
        .filter(Number.isFinite)
    : [];
  const promedio = numeros.length
    ? Number((numeros.reduce((a, b) => a + b, 0) / numeros.length).toFixed(2))
    : null;

  return {
    ...pregunta, respondidas, sinRespuesta, distribucion, promedio,
    minimo: numeros.length ? Math.min(...numeros) : null,
    maximo: numeros.length ? Math.max(...numeros) : null,
    tipoGrafico: esSeleccion ? "barras" : esNumerica ? "numerico" : "sin_grafico_automatico",
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = String(profile?.role ?? "").trim().toLowerCase().replace(/\s+/g, "");
    if (profileError || !["admin", "adminlectura"].includes(role)) {
      return NextResponse.json(
        { error: "No tenés permisos para consultar encuestas" },
        { status: 403 }
      );
    }

    const datos = await obtenerDatosEncuesta();
    const preguntasActuales = obtenerPreguntas(datos.formulario);
    const historicas = detectarCamposHistoricos(datos.respuestas, preguntasActuales);
    const estadisticas = [...preguntasActuales, ...historicas]
      .map((pregunta) => generarEstadistica(pregunta, datos.respuestas));

    return NextResponse.json({
      conectado: true,
      encuesta: datos.formulario.name,
      uid: datos.formulario.uid,
      total: datos.total,
      totalReportado: datos.totalReportado,
      cantidadPreguntas: preguntasActuales.length,
      cantidadCamposHistoricos: historicas.length,
      preguntas: estadisticas,
      actualizadoEn: datos.actualizadoEn,
    });
  } catch (error) {
    console.error("[Encuestas] Error al consultar Kobo:", error);
    return NextResponse.json(
      { conectado: false, error: "No se pudo consultar KoboToolbox" },
      { status: 502 }
    );
  }
}

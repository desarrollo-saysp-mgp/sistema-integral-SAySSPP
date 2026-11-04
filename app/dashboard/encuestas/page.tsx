import GraficoEvolucionInteractivo from "@/components/encuestas/GraficoEvolucionInteractivo";
import GraficoLineasInteractivo from "@/components/encuestas/GraficoLineasInteractivo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerDatosEncuesta, type KoboRespuesta } from "@/lib/kobo";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Layers3,
  MapPin,
  PieChart,
  RefreshCw,
  TrendingUp,
  Users,
  Table2,
  Activity,
  Filter,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Registro = Record<string, unknown>;
type Opcion = { valor: string; etiqueta: string; cantidad: number; porcentaje: number };
type Estadistica = {
  campo: string;
  etiqueta: string;
  tipo: string;
  respondidas: number;
  sinRespuesta: number;
  opciones: Opcion[];
};

const COLORES = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#f43f5e", "#06b6d4", "#64748b", "#84cc16"];
const FORMATO_NUMERO = new Intl.NumberFormat("es-AR");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function etiqueta(valor: unknown, respaldo: string): string {
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  if (Array.isArray(valor)) {
    const texto = valor.find((v) => typeof v === "string" && v.trim());
    if (typeof texto === "string") return texto;
  }
  if (esRegistro(valor)) {
    const texto = Object.values(valor).find((v) => typeof v === "string" && v.trim());
    if (typeof texto === "string") return texto;
  }
  return respaldo.replace(/_/g, " ");
}

function preguntasDelFormulario(formulario: Registro): Registro[] {
  const contenido = esRegistro(formulario.content) ? formulario.content : {};
  const survey = Array.isArray(contenido.survey) ? contenido.survey : [];
  return survey.filter(esRegistro);
}

function opcionesDelFormulario(formulario: Registro): Registro[] {
  const contenido = esRegistro(formulario.content) ? formulario.content : {};
  const choices = Array.isArray(contenido.choices) ? contenido.choices : [];
  return choices.filter(esRegistro);
}

function construirEstadisticas(formulario: Registro, respuestas: KoboRespuesta[]): Estadistica[] {
  const preguntas = preguntasDelFormulario(formulario);
  const choices = opcionesDelFormulario(formulario);
  const resultado: Estadistica[] = [];
  const ruta: string[] = [];

  for (const pregunta of preguntas) {
    const tipo = String(pregunta.type ?? "");
    const nombre = String(pregunta.name ?? "");
    if (tipo === "begin_group" || tipo === "begin_repeat") {
      if (nombre) ruta.push(nombre);
      continue;
    }
    if (tipo === "end_group" || tipo === "end_repeat") {
      ruta.pop();
      continue;
    }
    if (!nombre || (!tipo.startsWith("select_one") && !tipo.startsWith("select_multiple"))) continue;

    const campo = [...ruta, nombre].join("/");
    const lista = String(pregunta.select_from_list_name || pregunta.list_name || tipo.split(/\s+/).slice(1).join(" ")).trim();
    const catalogo = new Map<string, string>();
    for (const choice of choices) {
      if (lista && choice.list_name === lista) {
        const valor = String(choice.name ?? "");
        if (valor) catalogo.set(valor, etiqueta(choice.label, valor));
      }
    }

    const conteos = new Map<string, number>();
    let respondidas = 0;
    for (const respuesta of respuestas) {
      const bruto = respuesta[campo] ?? (campo === nombre ? undefined : respuesta[nombre]);
      if (bruto === null || bruto === undefined || String(bruto).trim() === "") continue;
      respondidas++;
      const valores = tipo.startsWith("select_multiple")
        ? String(bruto).trim().split(/\s+/)
        : [String(bruto)];
      for (const valor of new Set(valores)) {
        if (valor) conteos.set(valor, (conteos.get(valor) ?? 0) + 1);
      }
    }
    const opciones = [...conteos.entries()]
      .map(([valor, cantidad]) => ({
        valor,
        etiqueta: catalogo.get(valor) ?? valor.replace(/_/g, " "),
        cantidad,
        porcentaje: respondidas ? (cantidad / respondidas) * 100 : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
    resultado.push({
      campo,
      etiqueta: etiqueta(pregunta.label, nombre),
      tipo,
      respondidas,
      sinRespuesta: respuestas.length - respondidas,
      opciones,
    });
  }
  return resultado;
}

function mesDeRespuesta(respuesta: KoboRespuesta): string | null {
  const valor = respuesta.fecha ?? respuesta._submission_time;
  if (typeof valor !== "string") return null;
  // Kobo utiliza fechas ISO; evitamos interpretar fechas ambiguas.
  const resultado = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!resultado) return null;
  const mes = Number(resultado[2]);
  if (mes < 1 || mes > 12) return null;
  return `${resultado[1]}-${resultado[2]}`;
}

function obtenerSerieMensual(respuestas: KoboRespuesta[]) {
  const conteos = new Map<string, number>();
  for (const respuesta of respuestas) {
    const mes = mesDeRespuesta(respuesta);
    if (mes) conteos.set(mes, (conteos.get(mes) ?? 0) + 1);
  }
  const ordenados = [...conteos.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!ordenados.length) return [];
  const ultimos = ordenados.slice(-12);
  // Incluimos meses sin encuestas entre el primero y el último de la ventana.
  const [anioInicial, mesInicial] = ultimos[0][0].split("-").map(Number);
  const [anioFinal, mesFinal] = ultimos[ultimos.length - 1][0].split("-").map(Number);
  const serie: { clave: string; nombre: string; cantidad: number }[] = [];
  let anio = anioInicial;
  let mes = mesInicial;
  while (anio < anioFinal || (anio === anioFinal && mes <= mesFinal)) {
    const clave = `${anio}-${String(mes).padStart(2, "0")}`;
    serie.push({ clave, nombre: `${MESES[mes - 1]} ${String(anio).slice(-2)}`, cantidad: conteos.get(clave) ?? 0 });
    mes++;
    if (mes === 13) { mes = 1; anio++; }
  }
  return serie.slice(-12);
}

function GraficoCircular({ pregunta }: { pregunta: Estadistica }) {
  const opciones = pregunta.opciones;
  if (!pregunta.respondidas || !opciones.length) return <p className="rounded-lg bg-muted/30 px-4 py-5 text-sm text-muted-foreground">Todavía no hay respuestas. El gráfico se generará cuando Kobo registre las primeras.</p>;
  let acumulado = 0;
  const partes = opciones.map((opcion, i) => {
    const inicio = acumulado;
    acumulado += opcion.porcentaje;
    return `${COLORES[i % COLORES.length]} ${inicio}% ${acumulado}%`;
  });
  return <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
    <div className="relative h-44 w-44 shrink-0 rounded-full" style={{ background: `conic-gradient(${partes.join(", ")})` }} role="img" aria-label={`Distribución de ${pregunta.etiqueta}`}>
      <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-card">
        <span className="text-2xl font-bold tabular-nums">{FORMATO_NUMERO.format(pregunta.respondidas)}</span>
        <span className="text-xs text-muted-foreground">respuestas</span>
      </div>
    </div>
    <div className="w-full min-w-0 space-y-2">
      {opciones.slice(0, 8).map((opcion, i) => <div key={opcion.valor} className="flex items-start gap-2 text-xs">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORES[i % COLORES.length] }} />
        <span className="min-w-0 flex-1 break-words text-muted-foreground">{opcion.etiqueta}</span>
        <span className="shrink-0 font-semibold tabular-nums">{opcion.porcentaje.toFixed(1)}%</span>
      </div>)}
      {opciones.length > 8 && <p className="text-xs text-muted-foreground">+ {opciones.length - 8} opciones adicionales</p>}
    </div>
  </div>;
}

function TarjetaPregunta({ pregunta, indice }: { pregunta: Estadistica; indice: number }) {
  const circular = pregunta.opciones.length >= 2 && pregunta.opciones.length <= 5 && !pregunta.tipo.startsWith("select_multiple");
  return <article className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="mb-2 inline-block text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Pregunta {indice + 1}</span>
        <h3 className="text-sm font-semibold leading-6 sm:text-base">{pregunta.etiqueta}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{FORMATO_NUMERO.format(pregunta.respondidas)} respuestas · {FORMATO_NUMERO.format(pregunta.sinRespuesta)} sin responder</p>
      </div>
      {circular ? <PieChart className="h-5 w-5 shrink-0 text-muted-foreground" /> : <BarChart3 className="h-5 w-5 shrink-0 text-muted-foreground" />}
    </div>
    {circular ? <GraficoCircular pregunta={pregunta} /> : <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
      {pregunta.opciones.map((opcion, i) => <div key={opcion.valor}>
        <div className="mb-1.5 flex justify-between gap-3 text-xs sm:text-sm">
          <span className="min-w-0 break-words">{opcion.etiqueta}</span>
          <span className="shrink-0 font-semibold tabular-nums">{opcion.porcentaje.toFixed(1)}% <span className="font-normal text-muted-foreground">({opcion.cantidad})</span></span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${opcion.porcentaje}%`, backgroundColor: COLORES[i % COLORES.length] }} />
        </div>
      </div>)}
      {!pregunta.opciones.length && <p className="text-sm text-muted-foreground">Sin respuestas disponibles.</p>}
    </div>}
  </article>;
}

type Periodo = { anio: number; trimestre: number; clave: string; nombre: string };
type PuntajeIndicador = { campo: string; nombre: string; bueno: number; regular: number; malo: number; puntaje: number | null; respuestas: number };
type FilaTrimestral = {
  periodo: Periodo;
  total: number;
  indicadores: PuntajeIndicador[];
  promedioGeneral: number | null;
  indicadoresEvaluados: number;
};

// Correspondencia explícita con los indicadores de satisfacción.
// Las preguntas nuevas con la misma escala se detectan automáticamente;
// las demás no alteran el promedio hasta tener una regla válida.
const INDICADORES_BASE = [
  { campo: "cond_cam_rec", nombre: "Condiciones de los camiones", clase: "calidad" },
  { campo: "forma_cond_chofer", nombre: "Forma de conducir de los choferes", clase: "calidad" },
  { campo: "punt_serv", nombre: "Puntualidad del servicio", clase: "calidad" },
  { campo: "fechas_prog_rec_esp", nombre: "Recolección especial", clase: "frecuencia" },
  { campo: "_Qu_opini_n_tiene_s_alizan_por_su_barrio", nombre: "Jornadas Integrales de Limpieza", clase: "satisfaccion" },
  { campo: "_Cu_n_satisfecho_est_servicio_de_barrido", nombre: "Barrido", clase: "satisfaccion" },
  { campo: "cond_mant_esp_verdes", nombre: "Mantenimiento de espacios verdes", clase: "calidad" },
  { campo: "conf_areas_verdes", nombre: "Conformidad áreas verdes RNU", clase: "calidad" },
  { campo: "valor_func_cast", nombre: "Programa de castración", clase: "calidad" },
  { campo: "valor_func_antir", nombre: "Vacunación antirrábica", clase: "calidad" },
  { campo: "resp_seg_rec", nombre: "Gestión de reclamos", clase: "reclamos" },
] as const;

type Indicador = { campo: string; nombre: string; clase: "calidad" | "frecuencia" | "reclamos" | "satisfaccion" };

// Cada pregunta de selección única que use Satisfecho/Neutro/Insatisfecho
// pasa a ser un indicador automáticamente, sin depender de su ID interno.
function obtenerIndicadores(formulario: Registro): Indicador[] {
  const base: Indicador[] = INDICADORES_BASE.map(i => ({ ...i }));
  const conocidos = new Set(base.map(i => i.campo));
  const choices = opcionesDelFormulario(formulario);
  const ruta: string[] = [];
  for (const pregunta of preguntasDelFormulario(formulario)) {
    const tipo = String(pregunta.type ?? "").trim();
    const nombre = String(pregunta.name ?? "").trim();
    if (tipo === "begin_group" || tipo === "begin_repeat") { if (nombre) ruta.push(nombre); continue; }
    if (tipo === "end_group" || tipo === "end_repeat") { ruta.pop(); continue; }
    if (!nombre || !tipo.startsWith("select_one")) continue;
    const campo = [...ruta, nombre].join("/");
    if (conocidos.has(campo) || conocidos.has(nombre)) continue;
    const lista = String(pregunta.select_from_list_name || pregunta.list_name || tipo.split(/\s+/).slice(1).join(" ")).trim();
    const alternativas = choices.filter(c => lista && c.list_name === lista);
    const normalizar = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, " ").trim();
    const valores = new Set(alternativas.map(c => normalizar(c.name)));
    const etiquetas = new Set(alternativas.map(c => normalizar(etiqueta(c.label, String(c.name ?? "")))));
    const escala = ["satisfecho", "neutro", "insatisfecho"];
    const reconoceOpciones = escala.every(k => valores.has(k) || etiquetas.has(k));
    // Respaldo para formularios cuya metadata no incluya el catálogo de opciones.
    const nombreVisible = etiqueta(pregunta.label, nombre);
    const tituloNormalizado = normalizar(nombreVisible);
    const reconocePregunta = /cu[aá]n satisfecho|satisfaccion con el servicio/.test(tituloNormalizado);
    if (!reconoceOpciones && !(alternativas.length === 0 && reconocePregunta)) continue;
    const titulo = nombreVisible.replace(/^¿?Cu[aá]n satisfecho est[aá] con (el|la) servicio de\s*/i, "").replace(/\?$/, "").trim();
    base.push({ campo, nombre: titulo && titulo !== nombreVisible ? titulo : nombreVisible, clase: "satisfaccion" });
    conocidos.add(campo);
  }
  return base;
}

function fechaDeEncuesta(respuesta: KoboRespuesta): { anio: number; trimestre: number } | null {
  const valor = respuesta.fecha ?? respuesta._submission_time;
  if (typeof valor !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!match) return null;
  const anio = Number(match[1]), mes = Number(match[2]), dia = Number(match[3]);
  if (anio < 2000 || mes < 1 || mes > 12 || dia < 1 || dia > new Date(Date.UTC(anio, mes, 0)).getUTCDate()) return null;
  return { anio, trimestre: Math.ceil(mes / 3) };
}
function obtenerPeriodos(respuestas: KoboRespuesta[]): Periodo[] {
  const claves = new Set<string>();
  for (const respuesta of respuestas) {
    const f = fechaDeEncuesta(respuesta);
    if (f) claves.add(`${f.anio}-${f.trimestre}`);
  }
  return [...claves].sort().map(clave => {
    const [anio, trimestre] = clave.split("-").map(Number);
    return { anio, trimestre, clave, nombre: `T${trimestre} ${anio}` };
  });
}
function respuestasDelPeriodo(respuestas: KoboRespuesta[], periodo: Periodo) {
  return respuestas.filter(r => {
    const fecha = fechaDeEncuesta(r);
    return fecha?.anio === periodo.anio && fecha.trimestre === periodo.trimestre;
  });
}
function calcularPuntajes(respuestas: KoboRespuesta[], indicadores: Indicador[]): PuntajeIndicador[] {
  return indicadores.map(indicador => {
    let bueno = 0, regular = 0, malo = 0;
    for (const r of respuestas) {
      const raw = r[indicador.campo] ?? (indicador.campo.includes("/") ? r[indicador.campo.split("/").at(-1) ?? ""] : undefined);
      if (raw === null || raw === undefined) continue;
      const valor = String(raw).trim().toLowerCase();
      if (indicador.clase === "calidad") {
        if (valor === "bueno") bueno++;
        else if (valor === "regular") regular++;
        else if (valor === "malo") malo++;
      } else if (indicador.clase === "frecuencia") {
        if (valor === "siempre") bueno++;
        else if (valor === "a_veces") regular++;
        else if (valor === "nunca") malo++;
      } else if (indicador.clase === "reclamos") {
        if (valor === "si") bueno++;
        else if (valor === "no") regular++;
      } else if (indicador.clase === "satisfaccion") {
        if (valor === "satisfecho") bueno++;
        else if (valor === "neutro") regular++;
        else if (valor === "insatisfecho") malo++;
        // No estaba informado y N/A no son valoraciones.
      }
    }
    const total = bueno + regular + malo;
    const puntaje = total ? (bueno * 10 + regular * 7 + malo * 2) / total : null;
    return { campo: indicador.campo, nombre: indicador.nombre, bueno, regular, malo, puntaje, respuestas: total };
  });
}
function filaTrimestral(periodo: Periodo, respuestas: KoboRespuesta[], indicadoresDefinidos: Indicador[]): FilaTrimestral {
  const delPeriodo = respuestasDelPeriodo(respuestas, periodo);
  const indicadores = calcularPuntajes(delPeriodo, indicadoresDefinidos);
  const validos = indicadores.filter(i => i.puntaje !== null);
  const promedioGeneral = validos.length
    ? validos.reduce((acc, i) => acc + (i.puntaje ?? 0), 0) / validos.length
    : null;
  return { periodo, total: delPeriodo.length, indicadores, promedioGeneral, indicadoresEvaluados: validos.length };
}
function formatoPuntaje(n: number | null | undefined) { return n === null || n === undefined ? "—" : n.toFixed(2).replace(".", ","); }

// Histórico completo: se calcula desde las respuestas disponibles en Kobo,
// sin datos artificiales ni valores tomados de Google Sheets.
type FilaHistorica = { clave: string; nombre: string; total: number; promedio: number | null };

function obtenerHistorico(respuestas: KoboRespuesta[], agrupar: "mes" | "anio", indicadoresDefinidos: Indicador[]): FilaHistorica[] {
  const grupos = new Map<string, KoboRespuesta[]>();
  for (const respuesta of respuestas) {
    const mes = mesDeRespuesta(respuesta);
    if (!mes) continue;
    const clave = agrupar === "anio" ? mes.slice(0, 4) : mes;
    const grupo = grupos.get(clave) ?? [];
    grupo.push(respuesta);
    grupos.set(clave, grupo);
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([clave, grupo]) => {
    const validos = calcularPuntajes(grupo, indicadoresDefinidos).filter(p => p.puntaje !== null);
    return {
      clave,
      nombre: agrupar === "anio" ? clave : `${MESES[Number(clave.slice(5)) - 1]} ${clave.slice(0, 4)}`,
      total: grupo.length,
      promedio: validos.length ? validos.reduce((acc, p) => acc + (p.puntaje ?? 0), 0) / validos.length : null,
    };
  });
}

const COLORES_INDICADORES = ["#ef4444", "#f59e0b", "#16a34a", "#f97316", "#06b6d4", "#6366f1", "#ec4899", "#eab308", "#84cc16", "#8b5cf6", "#14b8a6"];

export default async function EncuestasPage({
  searchParams,
}: {
  searchParams?: Promise<{ periodo?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: perfil, error: perfilError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  const rol = String(perfil?.role ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (perfilError || !["admin", "adminlectura"].includes(rol)) redirect("/dashboard/accesos");

  let datos: Awaited<ReturnType<typeof obtenerDatosEncuesta>>;
  try {
    datos = await obtenerDatosEncuesta();
  } catch (err) {
    console.error("[Encuestas] Error al cargar Kobo:", err);
    return <main className="mx-auto w-full max-w-[1800px] space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/dashboard/accesos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a Accesos</Link>
      <div className="rounded-2xl border bg-card p-8">
        <h1 className="text-2xl font-bold">Encuestas</h1>
        <p className="mt-3 text-muted-foreground">No se pudieron consultar los datos de KoboToolbox. Verificá la conexión e intentá nuevamente.</p>
      </div>
    </main>;
  }

  const estadisticas = construirEstadisticas(datos.formulario as Registro, datos.respuestas);
  const indicadoresDefinidos = obtenerIndicadores(datos.formulario as Registro);
  const meses = obtenerSerieMensual(datos.respuestas);
  const barrios = estadisticas.find((p) => p.campo === "barrio");
  const edades = estadisticas.find((p) => p.campo === "rango_etario");
  const totalBarrios = barrios?.opciones.length ?? 0;
  const totalPreguntas = preguntasDelFormulario(datos.formulario as Registro).filter((p) => {
    const tipo = String(p.type ?? "");
    return tipo && !["start", "end", "note", "calculate", "hidden", "begin_group", "end_group", "begin_repeat", "end_repeat"].includes(tipo);
  }).length;
  const destacadas = estadisticas.filter((p) => p.campo !== "barrio" && p.campo !== "rango_etario");
  const ultimaActualizacion = new Date(datos.actualizadoEn);
  const periodos = obtenerPeriodos(datos.respuestas);
  const filtros = await searchParams;
  const seleccionado = periodos.find((p) => p.clave === filtros?.periodo) ?? periodos[periodos.length - 1];
  const filasTrimestrales = periodos.map((p) => filaTrimestral(p, datos.respuestas, indicadoresDefinidos));
  const respuestasSeleccionadas = seleccionado ? respuestasDelPeriodo(datos.respuestas, seleccionado) : [];
  const puntajesSeleccionados = calcularPuntajes(respuestasSeleccionadas, indicadoresDefinidos);
  const filaSeleccionada = filasTrimestrales.find((f) => f.periodo.clave === seleccionado?.clave);
  const historicoMensual = obtenerHistorico(datos.respuestas, "mes", indicadoresDefinidos);
  const historicoAnual = obtenerHistorico(datos.respuestas, "anio", indicadoresDefinidos);
  const periodosEtiquetas = filasTrimestrales.map((f) => f.periodo.nombre);
  const seriePromedio = [{
    id: "promedio", nombre: "Promedio general", color: "#0d9488",
    valores: filasTrimestrales.map((f) => f.promedioGeneral),
  }];
  const seriesServicios = indicadoresDefinidos.map((ind, i) => ({
    id: ind.nombre,
    nombre: ind.nombre,
    color: COLORES_INDICADORES[i % COLORES_INDICADORES.length],
    valores: filasTrimestrales.map((f) => f.indicadores.find((v) => v.nombre === ind.nombre)?.puntaje ?? null),
    fuente: "Kobo" as const,
  })).filter((serie) => serie.valores.some((v) => v !== null));

  // Todas las series se recalculan exclusivamente con respuestas de Kobo.
  // Los campos antiguos de Barrido y Jornadas se leen de las respuestas
  // aunque no estén declarados en el formulario actual.
  const etiquetasGrafico = periodosEtiquetas;
  const seriesGraficoServicios = seriesServicios;
  const serieMensualHistorica = [{
    id: "mensual", nombre: "Promedio mensual", color: "#0d9488",
    valores: historicoMensual.map((f) => f.promedio),
  }];



  return <main className="mx-auto w-full max-w-[1800px] space-y-7 px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/dashboard/accesos" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a Accesos</Link>
      <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Fuente: KoboToolbox
      </div>
    </div>

    <header className="relative overflow-hidden rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><TrendingUp className="h-3.5 w-3.5" /> Centro de estadísticas</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Encuestas ciudadanas</h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{datos.formulario.name}</p>
          <p className="text-xs text-muted-foreground">Datos consultados desde KoboToolbox · Actualizado: {Number.isNaN(ultimaActualizacion.getTime()) ? "Sin fecha" : ultimaActualizacion.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })}</p>
        </div>
        <Link href="/dashboard/encuestas" className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"><RefreshCw className="h-4 w-4" /> Actualizar vista</Link>
      </div>
    </header>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicadores principales">
      {[
        { titulo: "Encuestas recibidas", valor: FORMATO_NUMERO.format(datos.total), detalle: "Respuestas registradas", icono: ClipboardList, color: "text-emerald-600 dark:text-emerald-400", fondo: "bg-emerald-500/10" },
        { titulo: "Preguntas del formulario", valor: FORMATO_NUMERO.format(totalPreguntas), detalle: "Formulario actual", icono: Layers3, color: "text-blue-600 dark:text-blue-400", fondo: "bg-blue-500/10" },
        { titulo: "Barrios relevados", valor: FORMATO_NUMERO.format(totalBarrios), detalle: "Con al menos una respuesta", icono: MapPin, color: "text-violet-600 dark:text-violet-400", fondo: "bg-violet-500/10" },
      ].map(({ titulo, valor, detalle, icono: Icono, color, fondo }) => <div key={titulo} className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{titulo}</span><div className={`rounded-xl p-2.5 ${fondo}`}><Icono className={`h-5 w-5 ${color}`} /></div></div>
        <div className="mt-3 text-3xl font-bold tracking-tight tabular-nums">{valor}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>
      </div>)}
    </section>

    <section className="grid items-start gap-5 lg:grid-cols-5">
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-3">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-5 w-5 text-emerald-500" /> Evolución de encuestas</h2><p className="mt-1 text-xs text-muted-foreground">Respuestas registradas por mes · últimos períodos disponibles</p></div>
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
        </div>
        <GraficoEvolucionInteractivo datos={meses} />
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
        <div className="mb-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-blue-500" /> Perfil de encuestados</h2><p className="mt-1 text-xs text-muted-foreground">Distribución por rango etario</p></div>
        {edades ? <GraficoCircular pregunta={edades} /> : <p className="py-12 text-sm text-muted-foreground">La encuesta actual no incluye rango etario.</p>}
      </div>
    </section>

    {barrios && <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-violet-500" /> Participación por barrio</h2><p className="mt-1 text-xs text-muted-foreground">Respuestas por barrio · {FORMATO_NUMERO.format(barrios.respondidas)} encuestas con barrio informado</p></div>
      <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        {barrios.opciones.map((opcion, i) => <div key={opcion.valor}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs sm:text-sm"><span className="min-w-0 break-words">{opcion.etiqueta}</span><span className="shrink-0 font-semibold tabular-nums">{opcion.cantidad} · {opcion.porcentaje.toFixed(1)}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${opcion.porcentaje}%`, backgroundColor: COLORES[i % COLORES.length] }} /></div>
        </div>)}
      </div>
    </section>}

    <section className="w-full space-y-5" id="historico-encuestas">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><TrendingUp className="h-6 w-6 text-emerald-600" /> Histórico de satisfacción</h2>
        <p className="mt-1 text-sm text-muted-foreground">Evolución de los indicadores por trimestre. Pasá el cursor por los puntos para ver el valor exacto.</p>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Evolución trimestral de satisfacción con los servicios</h3>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">Cada línea corresponde a un servicio. Cada color identifica un servicio. Pasá el cursor por un punto para ver su valor y movelo para ocultar el detalle. Los puntajes se calculan con las respuestas disponibles.</p>
        <GraficoLineasInteractivo etiquetas={etiquetasGrafico} series={seriesGraficoServicios} maximo={10} unidad="/ 10" />
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Evolución del promedio general por trimestre</h3>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">Promedio de los indicadores puntuables de cada trimestre. Se calcula con los indicadores puntuables disponibles para cada trimestre.</p>
        <GraficoLineasInteractivo etiquetas={periodosEtiquetas} series={seriePromedio} maximo={10} unidad="/ 10" />
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-emerald-600" /> Histórico mensual completo</h3>
        <p className="mb-4 mt-1 text-xs text-muted-foreground">No se limita al trimestre seleccionado: incluye todos los meses con registros disponibles en Kobo.</p>
        <GraficoLineasInteractivo etiquetas={historicoMensual.map((f) => f.nombre)} series={serieMensualHistorica} maximo={10} unidad="/ 10" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-4">
            <h4 className="mb-3 text-sm font-semibold">Resumen histórico por año</h4>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 text-left font-medium">Año</th><th className="py-2 text-right font-medium">Encuestas</th><th className="py-2 text-right font-medium">Promedio / 10</th></tr></thead><tbody>
              {historicoAnual.map(f => <tr key={f.clave} className="border-b last:border-0"><td className="py-2 font-medium">{f.nombre}</td><td className="py-2 text-right tabular-nums">{FORMATO_NUMERO.format(f.total)}</td><td className="py-2 text-right font-semibold tabular-nums">{formatoPuntaje(f.promedio)}</td></tr>)}
            </tbody></table></div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <h4 className="mb-3 text-sm font-semibold">Cobertura histórica</h4>
            <p className="text-sm leading-6 text-muted-foreground">El histórico se calcula con las {FORMATO_NUMERO.format(datos.total)} respuestas disponibles desde Kobo. Los períodos sin registros no se muestran como si tuvieran datos.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="space-y-5" id="comparativa-trimestral">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Activity className="h-6 w-6 text-emerald-600" /> Análisis trimestral</h2>
          <p className="mt-1 text-sm text-muted-foreground">Compará períodos como en tu planilla, usando respuestas de Kobo.</p>
        </div>
        <form method="GET" action="/dashboard/encuestas" className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
          <Filter className="ml-2 h-4 w-4 text-muted-foreground" />
          <label htmlFor="periodo-encuestas" className="text-xs text-muted-foreground">Trimestre</label>
          <select id="periodo-encuestas" name="periodo" defaultValue={seleccionado?.clave ?? ""} className="rounded-lg border bg-background px-3 py-2 text-sm">
            {periodos.map((periodo) => <option key={periodo.clave} value={periodo.clave}>{periodo.nombre}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Aplicar</button>
        </form>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">Encuestas · {seleccionado?.nombre ?? "Sin período"}</p><p className="mt-2 text-3xl font-bold tabular-nums">{FORMATO_NUMERO.format(respuestasSeleccionadas.length)}</p><p className="mt-1 text-xs text-muted-foreground">Encuestas fechadas en el trimestre</p></div>
        <div className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">Promedio general de satisfacción</p><p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600">{formatoPuntaje(filaSeleccionada?.promedioGeneral)} <span className="text-base text-muted-foreground">/ 10</span></p><p className="mt-1 text-xs text-muted-foreground">Promedio simple de indicadores puntuables</p></div>
        <div className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">Indicadores evaluados</p><p className="mt-2 text-3xl font-bold tabular-nums">{filaSeleccionada?.indicadoresEvaluados ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">Con al menos una respuesta válida</p></div>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><Table2 className="h-5 w-5 text-blue-500" /> Resumen por trimestre</h3>
        {/* Vista para celulares: cada trimestre es una tarjeta completa. */}
        <div className="mt-4 space-y-2 md:hidden">
          {filasTrimestrales.map(fila => (
            <Link
              key={fila.periodo.clave}
              href={`/dashboard/encuestas?periodo=${fila.periodo.clave}#comparativa-trimestral`}
              className={`block rounded-xl border p-3 transition-colors hover:bg-muted/50 ${fila.periodo.clave === seleccionado?.clave ? "border-emerald-300 bg-emerald-500/10 dark:border-emerald-800" : "bg-background"}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold">{fila.periodo.nombre}</span>
                {fila.periodo.clave === seleccionado?.clave && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Seleccionado</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Encuestas</p><p className="mt-1 text-lg font-semibold tabular-nums">{FORMATO_NUMERO.format(fila.total)}</p></div>
                <div className="text-right"><p className="text-xs text-muted-foreground">Promedio / 10</p><p className="mt-1 text-lg font-bold tabular-nums text-emerald-600">{formatoPuntaje(fila.promedioGeneral)}</p></div>
              </div>
            </Link>
          ))}
        </div>
        {/* Vista de tabla original en pantallas grandes. */}
        <div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3 font-medium">Trimestre</th><th className="py-3 text-right font-medium">Encuestas</th><th className="py-3 text-right font-medium">Promedio / 10</th></tr></thead><tbody>
          {filasTrimestrales.map(fila => <tr key={fila.periodo.clave} className={`border-b last:border-0 ${fila.periodo.clave === seleccionado?.clave ? "bg-emerald-500/10" : ""}`}><td className="py-3 font-medium"><Link href={`/dashboard/encuestas?periodo=${fila.periodo.clave}#comparativa-trimestral`} className="hover:underline">{fila.periodo.nombre}</Link></td><td className="py-3 text-right tabular-nums">{fila.total}</td><td className="py-3 text-right font-semibold tabular-nums">{formatoPuntaje(fila.promedioGeneral)}</td></tr>)}
        </tbody></table></div>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Indicadores de satisfacción · {seleccionado?.nombre ?? "Sin período"}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Escalas aplicadas: Bueno/Satisfecho = 10, Regular/Neutro = 7 y Malo/Insatisfecho = 2. Las respuestas no evaluativas se excluyen.</p>
        {/* Tarjetas móviles: todas las cifras visibles sin scroll lateral. */}
        <div className="mt-4 grid gap-3 md:hidden">
          {puntajesSeleccionados.map(p => (
            <article key={p.nombre} className="rounded-xl border bg-background p-3.5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h4 className="min-w-0 flex-1 text-sm font-semibold leading-5">{p.nombre}</h4>
                <div className="shrink-0 text-right"><p className="text-[10px] text-muted-foreground">Puntaje / 10</p><p className="text-xl font-bold tabular-nums text-emerald-600">{formatoPuntaje(p.puntaje)}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-center">
                <div><p className="text-[10px] leading-4 text-muted-foreground">Bueno / Sí</p><p className="mt-1 font-semibold tabular-nums">{p.bueno}</p></div>
                <div><p className="text-[10px] leading-4 text-muted-foreground">Regular / A veces / No</p><p className="mt-1 font-semibold tabular-nums">{p.regular}</p></div>
                <div><p className="text-[10px] leading-4 text-muted-foreground">Malo / Nunca</p><p className="mt-1 font-semibold tabular-nums">{p.malo}</p></div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 hidden overflow-x-auto md:block"><table className="min-w-[680px] w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-3 font-medium">Indicador / Servicio</th><th className="py-3 text-right font-medium">Bueno / Sí</th><th className="py-3 text-right font-medium">Regular / A veces / No</th><th className="py-3 text-right font-medium">Malo / Nunca</th><th className="py-3 text-right font-medium">Puntaje / 10</th></tr></thead><tbody>
          {puntajesSeleccionados.map(p => <tr key={p.nombre} className="border-b last:border-0"><td className="max-w-[600px] py-3 pr-4 font-medium">{p.nombre}</td><td className="py-3 text-right tabular-nums">{p.bueno}</td><td className="py-3 text-right tabular-nums">{p.regular}</td><td className="py-3 text-right tabular-nums">{p.malo}</td><td className="py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatoPuntaje(p.puntaje)}</td></tr>)}
        </tbody></table></div>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold">Comparativa de indicadores entre trimestres</h3>
        <p className="mt-1 text-xs text-muted-foreground">Se recalcula en cada consulta desde Kobo. «—» significa que no hay respuestas comparables.</p>
        {/* Comparación por indicador en móvil, sin columnas escondidas. */}
        <div className="mt-4 grid gap-3 md:hidden">
          {indicadoresDefinidos.map(indicador => (
            <article key={indicador.nombre} className="rounded-xl border bg-background p-3.5">
              <h4 className="mb-3 text-sm font-semibold leading-5">{indicador.nombre}</h4>
              <div className="grid grid-cols-2 gap-2">
                {filasTrimestrales.map(fila => {
                  const puntaje = fila.indicadores.find(v => v.nombre === indicador.nombre)?.puntaje;
                  return (
                    <div key={fila.periodo.clave} className={`rounded-lg p-2.5 ${fila.periodo.clave === seleccionado?.clave ? "bg-emerald-500/10 ring-1 ring-emerald-500/25" : "bg-muted/40"}`}>
                      <p className="text-[11px] text-muted-foreground">{fila.periodo.nombre}</p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{formatoPuntaje(puntaje)} <span className="text-[10px] font-normal text-muted-foreground">/ 10</span></p>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
          <article className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5">
            <h4 className="mb-3 text-sm font-bold">Promedio general</h4>
            <div className="grid grid-cols-2 gap-2">
              {filasTrimestrales.map(fila => (
                <div key={fila.periodo.clave} className="rounded-lg bg-background/70 p-2.5">
                  <p className="text-[11px] text-muted-foreground">{fila.periodo.nombre}</p>
                  <p className="mt-1 text-base font-bold tabular-nums text-emerald-600">{formatoPuntaje(fila.promedioGeneral)} <span className="text-[10px] font-normal text-muted-foreground">/ 10</span></p>
                </div>
              ))}
            </div>
          </article>
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block"><table className="min-w-[850px] w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-3 pr-4 font-medium">Indicador</th>{filasTrimestrales.map(f => <th key={f.periodo.clave} className="px-3 py-3 text-right font-medium whitespace-nowrap">{f.periodo.nombre}</th>)}</tr></thead><tbody>
          {indicadoresDefinidos.map(i => <tr key={i.nombre} className="border-b last:border-0"><td className="py-3 pr-4 font-medium">{i.nombre}</td>{filasTrimestrales.map(f => <td key={f.periodo.clave} className="px-3 py-3 text-right tabular-nums">{formatoPuntaje(f.indicadores.find(v => v.nombre === i.nombre)?.puntaje)}</td>)}</tr>)}
          <tr className="bg-emerald-500/10 font-semibold"><td className="py-3 pr-4">Promedio general</td>{filasTrimestrales.map(f => <td key={f.periodo.clave} className="px-3 py-3 text-right tabular-nums">{formatoPuntaje(f.promedioGeneral)}</td>)}</tr>
        </tbody></table></div>
      </div>
    </section>

    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold tracking-tight">Resultados por pregunta</h2><p className="mt-1 text-sm text-muted-foreground">Gráficos generados automáticamente con las preguntas y opciones actuales de Kobo.</p></div></div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {destacadas.map((pregunta, i) => <TarjetaPregunta key={pregunta.campo} pregunta={pregunta} indice={i} />)}
      </div>
    </section>
    <p className="pb-4 text-center text-xs text-muted-foreground">Datos suministrados por KoboToolbox. Los gráficos descriptivos muestran porcentajes; la comparativa utiliza exclusivamente las escalas de puntaje declaradas. Indicadores antiguos sin equivalencia confirmada no se imputan.</p>
  </main>;
}

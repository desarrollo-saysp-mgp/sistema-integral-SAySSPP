"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { Check, ChevronDown, Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STREETS } from "@/lib/constants/streets";

// Constante segura para Client Components: no importar desde _access.ts.
const INTERVENTIONS_BASE = "/dashboard/solicitud-intervenciones";

type Row = {
  expediente: string | null;
  fecha: string | null;
  fecha_original: string | null;
  nombre_apellido: string | null;
  tipo: string | null;
  cantidad: number | null;
  especie: string | null;
  ubicacion_calle: string | null;
  calle?: string | null;
  altura?: string | null;
  estado: string | null;
  derivacion: string | null;
  retirado: string | null;
};
type Option = { categoria: string; valor: string };

const inputClass = "h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[#00A27F] focus-visible:ring-2 focus-visible:ring-[#00A27F]/15";

function normalizeForSearch(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").trim();
}

function SearchableSelect({
  name, label, values, initialValue, required = false, placeholder = "Buscar o escribir una opción",
}: {
  name: string;
  label: string;
  values: string[];
  initialValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const choices = useMemo(() => {
    const unique = Array.from(new Map(values.filter(Boolean).map(v => [normalizeForSearch(v), v])).values());
    const query = normalizeForSearch(value);
    return unique.filter(v => !query || normalizeForSearch(v).includes(query)).slice(0, 10);
  }, [value, values]);
  const exact = values.some(v => normalizeForSearch(v) === normalizeForSearch(value));
  const canAdd = value.trim().length > 0 && !exact;

  useEffect(() => {
    function dismiss(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  const select = (next: string) => {
    setValue(next);
    setOpen(false);
    setActive(0);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(i => Math.min(i + 1, choices.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive(i => Math.max(0, i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && open && choices[active]) {
      e.preventDefault();
      select(choices[active]);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0 space-y-1.5">
      <label htmlFor={`${listId}-input`} className="block text-sm font-medium">
        {label}{required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          name={name}
          value={value}
          onChange={e => { setValue(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          required={required}
          maxLength={250}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          placeholder={placeholder}
          className={`${inputClass} pl-10 pr-16`}
        />
        {value && <button type="button" aria-label={`Limpiar ${label}`} onClick={() => { setValue(""); setOpen(true); inputRef.current?.focus(); }} className="absolute right-10 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
        <button type="button" aria-label={`Mostrar opciones de ${label}`} aria-expanded={open} onClick={() => { setOpen(v => !v); inputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>
      </div>
      {open && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
          {choices.length > 0 ? choices.map((choice, index) => (
            <button
              type="button"
              role="option"
              aria-selected={normalizeForSearch(value) === normalizeForSearch(choice)}
              key={`${choice}-${index}`}
              onMouseEnter={() => setActive(index)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(choice)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active === index ? "bg-[#00A27F]/10 text-[#008C70] dark:text-[#00D6AA]" : "hover:bg-muted"}`}
            >
              <span className="break-words">{choice}</span>
              {normalizeForSearch(value) === normalizeForSearch(choice) && <Check className="h-4 w-4 shrink-0" />}
            </button>
          )) : <p className="px-3 py-2 text-xs text-muted-foreground">No hay coincidencias en el catálogo.</p>}
          {canAdd && <div className="mt-1 border-t px-3 py-2 text-xs text-[#008C70] dark:text-[#00D6AA]">Nuevo valor: <strong className="break-all">{value.trim()}</strong>. Se guardará al registrar la solicitud.</div>}
          {!value && choices.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Escribí una opción nueva.</p>}
        </div>
      )}
    </div>
  );
}


/**
 * Direcciones nuevas: calle seleccionada de STREETS + numeración.
 * Las ubicaciones históricas permanecen intactas en modo texto libre.
 * Se guarda en la columna existente ubicacion_calle, sin geocodificar.
 */
/**
 * Reconoce direcciones históricas sin modificarlas automáticamente.
 * STREETS es una tupla de literales `as const`: para construir aliases
 * usamos `string[]`, no el tipo restringido de cada calle.
 */
function parseStoredAddress(stored: string): { street: string; number: string } | null {
  const source = stored.trim();
  if (!source) return null;

  const comparable = (text: string) =>
    normalizeForSearch(text).replace(/\s+/g, " ");
  const normalizedSource = comparable(source);

  const streetOptions: string[] = [...STREETS].sort(
    (a, b) => b.length - a.length,
  );

  for (const candidate of streetOptions) {
    const aliases: string[] = [candidate];
    if (/^calle\s/i.test(candidate)) {
      aliases.push(candidate.replace(/^calle\s+/i, ""));
      // Reconoce datos viejos con el prefijo duplicado, sin duplicarlo al guardar.
      aliases.push(`Calle ${candidate}`);
    } else {
      aliases.push(`Calle ${candidate}`);
    }

    for (const alias of aliases) {
      const normalizedAlias = comparable(alias);
      if (normalizedSource === normalizedAlias) {
        return { street: candidate, number: "" };
      }
      if (!normalizedSource.startsWith(`${normalizedAlias} `)) continue;

      const suffix = source.slice(alias.length).trim();
      // Solo separa alturas sencillas. Esquinas y referencias permanecen libres.
      if (/^(?:(?:n[.°º\s]*|nro\.?\s*|numero\s*)?\d+[a-z]?(?:\s+bis)?)$/i.test(suffix)) {
        return { street: candidate, number: suffix };
      }
    }
  }

  return null;
}

function InterventionAddress({ initialValue, initialStreet, initialNumber }: { initialValue?: string | null; initialStreet?: string | null; initialNumber?: string | null }) {
  const original = initialValue ?? "";
  const parsed = useMemo(() => {
    if (initialStreet && (STREETS as readonly string[]).includes(initialStreet)) {
      return { street: initialStreet, number: initialNumber ?? "" };
    }
    return parseStoredAddress(original);
  }, [original, initialStreet, initialNumber]);
  const [mode, setMode] = useState<"street" | "free">(
    !original.trim() || parsed ? "street" : "free",
  );
  const [street, setStreet] = useState<string>(parsed?.street ?? "");
  const [streetQuery, setStreetQuery] = useState(parsed?.street ?? "");
  const [number, setNumber] = useState(parsed?.number ?? "");
  const [free, setFree] = useState(original);
  const [streetModified, setStreetModified] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();

  const matching = useMemo(() => {
    const q = normalizeForSearch(streetQuery);
    return STREETS.filter(s => !q || normalizeForSearch(s).includes(q)).slice(0, 12);
  }, [streetQuery]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const combined = mode === "free"
    ? free.trim()
    : street
      ? (!streetModified && parsed && street === parsed.street && number === parsed.number
        ? original
        : [street, number.trim()].filter(Boolean).join(" "))
      : "";

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Ubicados en calle</span>
        <div className="inline-flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1 text-xs">
          <button type="button" onClick={() => { setMode("street"); setOpen(false); }} className={`rounded-lg px-3 py-1.5 transition-colors ${mode === "street" ? "bg-background font-semibold text-[#008C70] shadow-sm dark:text-[#00D6AA]" : "text-muted-foreground hover:text-foreground"}`}>Buscar calle</button>
          <button type="button" onClick={() => { setMode("free"); setOpen(false); }} className={`rounded-lg px-3 py-1.5 transition-colors ${mode === "free" ? "bg-background font-semibold text-[#008C70] shadow-sm dark:text-[#00D6AA]" : "text-muted-foreground hover:text-foreground"}`}>Dirección libre</button>
        </div>
      </div>
      <input type="hidden" name="ubicacion_calle" value={combined} />
      <input type="hidden" name="direccion_modo" value={mode} />
      <input type="hidden" name="calle" value={mode === "street" ? street : ""} />
      <input type="hidden" name="altura" value={mode === "street" ? number.trim() : ""} />
      {mode === "street" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(120px,1fr)]">
          <div ref={rootRef} className="relative min-w-0 space-y-1.5">
            <label htmlFor={`${fieldId}-calle`} className="text-xs font-medium text-muted-foreground">Calle de General Pico</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id={`${fieldId}-calle`} autoComplete="off" value={streetQuery} onFocus={() => setOpen(true)}
                onChange={e => { setStreetQuery(e.target.value); setStreet(""); setStreetModified(true); setOpen(true); }}
                placeholder="Buscá y seleccioná una calle" role="combobox" aria-expanded={open} aria-controls={`${fieldId}-results`}
                className={`${inputClass} pl-10`} />
            </div>
            {open && (
              <div id={`${fieldId}-results`} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
                {matching.length ? matching.map(item => (
                  <button type="button" role="option" aria-selected={street === item} key={item}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setStreet(item); setStreetQuery(item); setStreetModified(true); setOpen(false); }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#00A27F]/10">
                    <span>{item}</span>{street === item && <Check className="h-4 w-4 text-[#00A27F]" />}
                  </button>
                )) : <p className="px-3 py-2 text-sm text-muted-foreground">No se encontraron calles. Podés usar Dirección libre.</p>}
              </div>
            )}
            {streetQuery && !street && <p className="text-xs text-amber-700 dark:text-amber-400">Seleccioná una calle del listado para guardar la dirección.</p>}
          </div>
          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Número / altura</span>
            <input value={number} onChange={e => { setNumber(e.target.value); setStreetModified(true); }} maxLength={60} placeholder="Ej.: 1972 o 1845 bis" className={inputClass} />
          </label>
        </div>
      ) : (
        <div className="space-y-1.5">
          <input value={free} onChange={e => setFree(e.target.value)} maxLength={350} className={inputClass}
            placeholder="Ej.: Calle 7 N.º 1972, esquina o referencia" />
          <p className="text-xs text-muted-foreground">Permite conservar direcciones históricas, esquinas y referencias que no coinciden con el catálogo de calles.</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Al guardar, se intentará ubicar la dirección seleccionada en el mapa. Si no se encuentra, se conservará el texto sin coordenadas.</p>
    </div>
  );
}

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className="min-w-[160px] rounded-xl bg-[#00A27F] px-6 hover:bg-[#008C70] disabled:cursor-wait disabled:opacity-75">
      {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editing ? "Guardando cambios..." : "Guardando solicitud..."}</> : editing ? "Guardar cambios" : "Guardar solicitud"}
    </Button>
  );
}

export function InterventionForm({ row, options, action, error }: {
  row?: Row;
  options: Option[];
  action: (data: FormData) => Promise<void>;
  error?: string;
}) {
  const choices = (category: string) => options.filter(v => v.categoria === category).map(v => v.valor);
  return (
    <Card className="overflow-visible rounded-2xl border-border shadow-sm">
      <CardHeader className="border-b pb-5">
        <CardTitle className="text-lg sm:text-xl">{row ? "Editar intervención" : "Nueva intervención"}</CardTitle>
        <p className="text-sm text-muted-foreground">Buscá una opción existente o escribí un valor nuevo. Al guardar la solicitud, las opciones nuevas quedan en el catálogo para próximas cargas.</p>
      </CardHeader>
      <CardContent className="pt-6">
        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</div>}
        <form action={action} className="space-y-7">
          <div className="space-y-4">
            <h2 className="border-l-[3px] border-[#00A27F] pl-3 text-sm font-semibold">Datos de la solicitud</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1.5 text-sm font-medium">Número de expediente <span className="text-rose-500">*</span><input name="expediente" required maxLength={80} defaultValue={row?.expediente ?? ""} className={inputClass} /></label>
              <label className="space-y-1.5 text-sm font-medium">Fecha {!row && <span className="text-rose-500">*</span>}<input name="fecha" type="date" required={!row} defaultValue={row?.fecha ?? ""} className={inputClass} />{row && !row.fecha && row.fecha_original && <small className="block font-normal text-amber-700 dark:text-amber-400">Fecha original sin normalizar: {row.fecha_original}. Si la dejás vacía, se conserva.</small>}</label>
              <label className="space-y-1.5 text-sm font-medium">Nombre y apellido <span className="text-rose-500">*</span><input name="nombre_apellido" required maxLength={250} defaultValue={row?.nombre_apellido ?? ""} className={inputClass} /></label>
              <SearchableSelect name="tipo" label="Tipo de intervención" values={choices("tipo")} initialValue={row?.tipo} required />
              <label className="space-y-1.5 text-sm font-medium">Cantidad <span className="text-rose-500">*</span><input name="cantidad" type="number" min="1" max="100000" step="1" required defaultValue={row?.cantidad ?? 1} className={inputClass} /></label>
              <SearchableSelect name="especie" label="Especie" values={choices("especie")} initialValue={row?.especie} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-l-[3px] border-[#00A27F] pl-3"><MapPin className="h-4 w-4 text-[#00A27F]"/><h2 className="text-sm font-semibold">Ubicación de la intervención</h2></div>
            <InterventionAddress initialValue={row?.ubicacion_calle} initialStreet={row?.calle} initialNumber={row?.altura} />
          </div>
          <div className="space-y-4">
            <h2 className="border-l-[3px] border-[#00A27F] pl-3 text-sm font-semibold">Resolución y seguimiento</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SearchableSelect name="estado" label="Estado" values={choices("estado")} initialValue={row?.estado} />
              <SearchableSelect name="derivacion" label="¿Se derivó?" values={choices("derivacion")} initialValue={row?.derivacion} />
              <SearchableSelect name="retirado" label="¿Retirado?" values={choices("retirado")} initialValue={row?.retirado} placeholder="Sin informar / Buscar opción" />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <Button asChild type="button" variant="outline" className="rounded-xl"><Link href={INTERVENTIONS_BASE}>Cancelar</Link></Button>
            <SaveButton editing={Boolean(row)} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

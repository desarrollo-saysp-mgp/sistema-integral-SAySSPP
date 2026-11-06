"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, X } from "lucide-react";

type Kind = "area" | "task";
type Option = { id: string; value: string };

type Props = {
  kind: Kind;
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  open: boolean;
};

export function PersonnelCatalogField({ kind, id, value, onChange, disabled = false, open }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [mode, setMode] = useState<"select" | "add" | "edit">("select");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const { data, error: queryError } = await createClient()
      .from("personnel_catalog_options")
      .select("id, value")
      .eq("kind", kind)
      .order("value", { ascending: true });
    if (queryError) {
      setError("No se pudo cargar el catálogo. Verificá que hayas ejecutado el SQL.");
      setReady(false);
    } else {
      setOptions((data ?? []) as Option[]);
      setError("");
      setReady(true);
    }
  }, [kind]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setMode("select");
    setDraft("");
    setReady(false);
    // The async fetch is scoped to the open dialog.
    void (async () => {
      const { data, error: queryError } = await createClient()
        .from("personnel_catalog_options")
        .select("id, value")
        .eq("kind", kind)
        .order("value", { ascending: true });
      if (!active) return;
      if (queryError) {
        setError("No se pudo cargar el catálogo. Verificá que hayas ejecutado el SQL.");
        setReady(false);
      } else {
        setOptions((data ?? []) as Option[]);
        setError("");
        setReady(true);
      }
    })();
    return () => { active = false; };
  }, [open, kind]);

  const selected = options.find((option) => option.value === value);
  const legacy = Boolean(value && !selected);

  const save = async () => {
    const next = draft.trim().replace(/\s+/g, " ");
    if (!next) { setError("Escribí un valor antes de guardar."); return; }
    if (next.length > 200) { setError("Máximo 200 caracteres."); return; }
    if (options.some((option) => option.value.toLocaleLowerCase("es") === next.toLocaleLowerCase("es") && (mode !== "edit" || option.id !== selected?.id))) {
      setError("Ese valor ya existe en la lista."); return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      if (mode === "add") {
        const { error: insertError } = await supabase
          .from("personnel_catalog_options")
          .insert({ kind, value: next });
        if (insertError) throw insertError;
        onChange(next);
      } else if (mode === "edit" && selected) {
        // SQL function updates both the catalog and the personnel using this value, atomically.
        const { error: renameError } = await supabase.rpc("rename_personnel_catalog_option", {
          p_option_id: selected.id,
          p_new_value: next,
        });
        if (renameError) throw renameError;
        onChange(next);
      } else {
        setError("Elegí primero un valor guardado para editarlo.");
        return;
      }
      await load();
      setMode("select");
      setDraft("");
    } catch (saveError) {
      console.error("Error en catálogo de Personal", saveError);
      setError("No se pudo guardar. Revisá permisos o si el valor ya existe.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {mode === "select" ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          <Select value={value || undefined} onValueChange={onChange} disabled={disabled || !ready}>
            <SelectTrigger id={id} className="min-w-[180px] flex-1 [&>span]:truncate">
              <SelectValue placeholder={ready ? "Seleccionar de la lista" : "Cargando lista..."} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {legacy && <SelectItem value={value}>{value} (valor anterior)</SelectItem>}
              {options.map((option) => (
                <SelectItem key={option.id} value={option.value}>{option.value}</SelectItem>
              ))}
              {options.length === 0 && !legacy && (
                <div className="px-2 py-2 text-sm text-muted-foreground">Todavía no hay valores guardados.</div>
              )}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" disabled={disabled || !ready} onClick={() => { setDraft(""); setError(""); setMode("add"); }}>
            <Plus className="mr-1 size-4" /> Agregar
          </Button>
          <Button type="button" variant="outline" disabled={disabled || !ready || !selected} onClick={() => { setDraft(value); setError(""); setMode("edit"); }}>
            <Pencil className="mr-1 size-4" /> Editar
          </Button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-wrap gap-2">
          <Input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200}
            placeholder={mode === "add" ? "Escribí el nuevo valor" : "Corregí el valor seleccionado"}
            disabled={disabled || busy} className="min-w-[200px] flex-1" />
          <Button type="button" disabled={disabled || busy} onClick={() => void save()}>
            {busy ? "Guardando..." : "Guardar"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setMode("select"); setError(""); }}>
            <X className="mr-1 size-4" /> Cancelar
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {legacy && mode === "select" && <p className="text-xs text-muted-foreground">Este valor pertenece a un registro anterior. Podés conservarlo o crear una opción nueva en el catálogo.</p>}
    </div>
  );
}

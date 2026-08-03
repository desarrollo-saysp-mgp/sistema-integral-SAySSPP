"use client";

import {
  Check,
  Loader2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

export type LocalidadOption = {
  id: string;
  nombre: string;
  provincia: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accent?: "emerald" | "sky";
};

const DEFAULT_LOCALITY: LocalidadOption = {
  id: "general-pico-la-pampa",
  nombre: "General Pico",
  provincia: "La Pampa",
  label: "General Pico, La Pampa",
};

export default function LocalidadSelector({
  value,
  onChange,
  placeholder = "Buscar localidad...",
  accent = "emerald",
}: Props) {
  const [inputValue, setInputValue] = useState(value);

  const [options, setOptions] = useState<
    LocalidadOption[]
  >([]);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedValue, setSelectedValue] =
    useState(value);

  const containerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
    setSelectedValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent,
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, []);

  useEffect(() => {
    const query = inputValue.trim();

    if (
      query.length < 2 ||
      query === selectedValue
    ) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const controller =
      new AbortController();

    const timeout = window.setTimeout(
      async () => {
        try {
          setLoading(true);

          const response = await fetch(
            `/api/georef/localidades?q=${encodeURIComponent(
              query,
            )}`,
            {
              signal: controller.signal,
            },
          );

          if (!response.ok) {
            setOptions([]);
            return;
          }

          const data = await response.json();

          const apiOptions = Array.isArray(
            data.localidades,
          )
            ? (data.localidades as LocalidadOption[])
            : [];

          const normalizedQuery =
            query
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");

          const defaultMatches =
            DEFAULT_LOCALITY.label
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .includes(normalizedQuery);

          const hasDefaultAlready =
            apiOptions.some(
              (option) =>
                option.label ===
                DEFAULT_LOCALITY.label,
            );

          const orderedOptions =
            defaultMatches &&
            !hasDefaultAlready
              ? [
                  DEFAULT_LOCALITY,
                  ...apiOptions,
                ]
              : apiOptions.sort((a, b) => {
                  if (
                    a.label ===
                    DEFAULT_LOCALITY.label
                  ) {
                    return -1;
                  }

                  if (
                    b.label ===
                    DEFAULT_LOCALITY.label
                  ) {
                    return 1;
                  }

                  return a.label.localeCompare(
                    b.label,
                    "es",
                  );
                });

          setOptions(orderedOptions);
          setOpen(true);
        } catch (error) {
          if (
            error instanceof Error &&
            error.name === "AbortError"
          ) {
            return;
          }

          console.error(
            "Error buscando localidades:",
            error,
          );

          setOptions([]);
        } finally {
          setLoading(false);
        }
      },
      350,
    );

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [inputValue, selectedValue]);

  function handleInputChange(
    newValue: string,
  ) {
    setInputValue(newValue);

    if (newValue !== selectedValue) {
      setSelectedValue("");
      onChange("");
    }

    if (!newValue.trim()) {
      setOptions([]);
      setOpen(true);
      onChange("");
    }
  }

  function handleSelect(
    option: LocalidadOption,
  ) {
    setInputValue(option.label);
    setSelectedValue(option.label);
    setOptions([]);
    setOpen(false);

    onChange(option.label);
  }

  function clearSelection() {
    setInputValue("");
    setSelectedValue("");
    setOptions([]);
    setOpen(true);

    onChange("");
  }

  const isSelected =
    Boolean(selectedValue) &&
    selectedValue === inputValue;

  const focusClasses =
    accent === "sky"
      ? "focus-within:border-sky-600 focus-within:ring-sky-600/20"
      : "focus-within:border-emerald-600 focus-within:ring-emerald-600/20";

  const frequentButtonClasses =
    accent === "sky"
      ? "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
      : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";

  const frequentIconClasses =
    accent === "sky"
      ? "text-sky-700"
      : "text-emerald-700";

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <div
        className={`flex min-h-12 items-center rounded-xl border bg-background transition focus-within:ring-2 ${focusClasses}`}
      >
        <Search className="ml-4 h-4 w-4 shrink-0 text-muted-foreground" />

        <input
          type="text"
          value={inputValue}
          onChange={(event) =>
            handleInputChange(
              event.target.value,
            )
          }
          onFocus={() => {
            if (!isSelected) {
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
        />

        {loading ? (
          <Loader2 className="mr-4 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : isSelected ? (
          <Check className="mr-4 h-4 w-4 shrink-0 text-emerald-600" />
        ) : inputValue ? (
          <button
            type="button"
            onClick={clearSelection}
            className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
            aria-label="Limpiar localidad"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {!inputValue && !isSelected ? (
        <button
          type="button"
          onClick={() =>
            handleSelect(DEFAULT_LOCALITY)
          }
          className={`mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${frequentButtonClasses}`}
        >
          <MapPin
            className={`h-4 w-4 shrink-0 ${frequentIconClasses}`}
          />

          <div className="min-w-0">
            <p className="text-sm font-semibold">
              General Pico, La Pampa
            </p>

            <p className="text-xs opacity-80">
              Opción frecuente
            </p>
          </div>
        </button>
      ) : null}

      {inputValue &&
      !isSelected &&
      inputValue.trim().length >= 2 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Seleccioná una localidad de la
          lista para confirmarla.
        </p>
      ) : null}

      {open && !isSelected ? (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border bg-background shadow-lg">
          {!inputValue.trim() ? (
            <div className="p-1.5">
              <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Opción frecuente
              </p>

              <button
                type="button"
                onClick={() =>
                  handleSelect(
                    DEFAULT_LOCALITY,
                  )
                }
                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${frequentButtonClasses}`}
              >
                <MapPin
                  className={`mt-0.5 h-4 w-4 shrink-0 ${frequentIconClasses}`}
                />

                <div className="min-w-0">
                  <p className="font-semibold">
                    General Pico
                  </p>

                  <p className="text-sm opacity-80">
                    La Pampa
                  </p>
                </div>
              </button>

              <p className="px-3 pb-1 pt-3 text-xs text-muted-foreground">
                También podés escribir otra localidad.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando localidades...
            </div>
          ) : options.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground">
              No se encontraron localidades.
            </div>
          ) : (
            <div className="p-1.5">
              {options.map((option) => {
                const isGeneralPico =
                  option.label ===
                  DEFAULT_LOCALITY.label;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      handleSelect(option)
                    }
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                      isGeneralPico
                        ? frequentButtonClasses
                        : "hover:bg-muted"
                    }`}
                  >
                    <MapPin
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        isGeneralPico
                          ? frequentIconClasses
                          : "text-muted-foreground"
                      }`}
                    />

                    <div className="min-w-0">
                      <p
                        className={
                          isGeneralPico
                            ? "font-semibold"
                            : "font-medium"
                        }
                      >
                        {option.nombre}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {option.provincia}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
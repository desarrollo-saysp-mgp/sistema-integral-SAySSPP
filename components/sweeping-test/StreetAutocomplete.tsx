"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type StreetOption = {
  name: string;
  normalized_name: string;
};

type StreetAutocompleteProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (street: StreetOption) => void;
  placeholder?: string;
};

export default function StreetAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  placeholder = "Escribí una calle...",
}: StreetAutocompleteProps) {
  const [options, setOptions] = useState<StreetOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const search = value.trim();

    if (search.length < 1) {
      setOptions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/test-sweeping/streets?q=${encodeURIComponent(search)}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "No se pudieron obtener las calles."
          );
        }

        /*
         * Eliminamos posibles calles duplicadas.
         *
         * OpenStreetMap puede tener varios segmentos con el mismo
         * nombre. Para el usuario necesitamos mostrar la calle una
         * sola vez.
         */
        const uniqueOptions = Array.from(
          new Map<string, StreetOption>(
            (data || []).map((street: StreetOption) => [
              `${street.normalized_name}-${street.name}`,
              street,
            ])
          ).values()
        );

        setOptions(uniqueOptions);
        setOpen(true);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Error buscando calles para autocomplete:",
          error
        );

        setOptions([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  function selectStreet(option: StreetOption) {
    onChange(option.name);

    if (onSelect) {
      onSelect(option);
    }

    setOptions([]);
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative space-y-2"
    >
      <label className="text-sm font-medium">
        {label}
      </label>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value.trim()) {
            setOpen(true);
          }
        }}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      {open && (
        <div className="absolute left-0 right-0 top-full z-[3000] mt-1 max-h-64 overflow-y-auto rounded-md border bg-background shadow-xl">
          {loading && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              Buscando...
            </div>
          )}

          {!loading &&
            options.length > 0 &&
            options.map((option, index) => (
              <button
                key={`${option.normalized_name}-${option.name}-${index}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  selectStreet(option);
                }}
                className="block w-full border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted"
              >
                {option.name}
              </button>
            ))}

          {!loading &&
            options.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                No se encontraron calles
              </div>
            )}
        </div>
      )}
    </div>
  );
}
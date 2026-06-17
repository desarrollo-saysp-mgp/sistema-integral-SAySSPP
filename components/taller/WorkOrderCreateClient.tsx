"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AREA_SOLICITANTE_OPTIONS,
  DRIVER_OPTIONS,
  FAILURE_REPORT_OPTIONS,
  LOCALIZACION_FALLA_OPTIONS,
  PROVIDER_OPTIONS,
  REPAIR_TYPE_OPTIONS,
  REQUIRES_SPARE_PART_OPTIONS,
  STATUS_OPTIONS,
  TIPO_FALLA_OPTIONS,
  VEHICLE_OPTIONS,
} from "@/lib/taller/options";

type AmountCurrency = "ARS" | "USD";

type WorkOrderFormData = {
  order_number: string;
  entry_date: string;
  requesting_area: string;
  failure_report: string;
  repair_type: string;
  vehicle_code: string;
  criticality: string;
  failure_type: string;
  failure_location: string;
  requires_spare_part: string;
  vehicle: string;
  license_plate: string;
  exit_date: string;
  spare_part_detail: string;
  provider: string;
  amount: string;
  amount_currency: AmountCurrency;
  observations: string;
  driver: string;
  status: string;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const CURRENCY_MARKER_REGEX = /\n?\[\[amount_currency:(ARS|USD)\]\]/g;

const initialFormData: WorkOrderFormData = {
  order_number: "",
  entry_date: "",
  requesting_area: "",
  failure_report: "",
  repair_type: "",
  vehicle_code: "",
  criticality: "--",
  failure_type: "",
  failure_location: "",
  requires_spare_part: "",
  vehicle: "",
  license_plate: "",
  exit_date: "",
  spare_part_detail: "",
  provider: "",
  amount: "",
  amount_currency: "ARS",
  observations: "",
  driver: "",
  status: "INICIADO",
};

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getUniqueOptions = (options: readonly string[]) => {
  const seen = new Set<string>();

  return options
    .map((option) => String(option || "").trim())
    .filter((option) => {
      if (!option) return false;

      const normalized = normalizeText(option);

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
};

const getCriticalityValue = (value?: string | number | null) => {
  const cleanValue = String(value ?? "").trim();

  return cleanValue || "--";
};

const getCriticalityClass = (criticality?: string | number | null) => {
  const value = Number(criticality);

  if (!Number.isFinite(value)) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  if (value >= 13) {
    return "border-red-200 bg-red-100 text-red-800";
  }

  if (value >= 10) {
    return "border-yellow-200 bg-yellow-100 text-yellow-800";
  }

  return "border-green-200 bg-green-100 text-green-800";
};

const cleanObservations = (value: string) => {
  return String(value || "").replace(CURRENCY_MARKER_REGEX, "").trim();
};

const buildObservationsWithCurrency = (
  observations: string,
  currency: AmountCurrency,
) => {
  const cleanedObservations = cleanObservations(observations);

  return [cleanedObservations, `[[amount_currency:${currency}]]`]
    .filter(Boolean)
    .join("\n");
};

const getSpeechRecognitionConstructor = () => {
  if (typeof window === "undefined") return null;

  const browserWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
};

export function WorkOrderCreateClient() {
  const router = useRouter();

  const [formData, setFormData] = useState<WorkOrderFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseObservationTextRef = useRef("");

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognitionConstructor()));

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const vehicleCodeOptions = useMemo(
    () => getUniqueOptions(VEHICLE_OPTIONS.map((item) => item.code)),
    [],
  );

  const vehicleNameOptions = useMemo(
    () => getUniqueOptions(VEHICLE_OPTIONS.map((item) => item.vehicle)),
    [],
  );

  const providerOptions = useMemo(() => getUniqueOptions(PROVIDER_OPTIONS), []);

  const handleChange = (field: keyof WorkOrderFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCurrencyChange = (value: string) => {
    if (value !== "ARS" && value !== "USD") return;

    setFormData((prev) => ({
      ...prev,
      amount_currency: value,
    }));
  };

  const handleVehicleCodeChange = (value: string) => {
    const selectedVehicle = VEHICLE_OPTIONS.find(
      (item) => normalizeText(item.code) === normalizeText(value),
    );

    setFormData((prev) => ({
      ...prev,
      vehicle_code: value,
      vehicle: selectedVehicle?.vehicle ?? prev.vehicle,
      license_plate: selectedVehicle?.licensePlate ?? prev.license_plate,
      criticality: getCriticalityValue(selectedVehicle?.criticality),
    }));
  };

  const handleVehicleNameChange = (value: string) => {
    const selectedVehicle = VEHICLE_OPTIONS.find(
      (item) => normalizeText(item.vehicle) === normalizeText(value),
    );

    setFormData((prev) => ({
      ...prev,
      vehicle: value,
      vehicle_code: selectedVehicle?.code ?? prev.vehicle_code,
      license_plate: selectedVehicle?.licensePlate ?? prev.license_plate,
      criticality: getCriticalityValue(selectedVehicle?.criticality),
    }));
  };

  const hasAtLeastOneValue = () => {
    return Object.entries(formData).some(([key, value]) => {
      if (key === "criticality") return value !== "--";
      if (key === "status") return false;
      if (key === "amount_currency") return false;

      return String(value || "").trim() !== "";
    });
  };

  const startVoiceDictation = () => {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionConstructor) {
      setVoiceSupported(false);
      toast.error(
        "Tu navegador no permite dictado por voz. Probá con Chrome o escribí la observación manualmente.",
      );
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new SpeechRecognitionConstructor();

    recognition.lang = "es-AR";
    recognition.continuous = true;
    recognition.interimResults = true;

    baseObservationTextRef.current = formData.observations.trim();

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() || "";

        if (!transcript) continue;

        if (result.isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interimTranscript += `${transcript} `;
        }
      }

      const parts = [
        baseObservationTextRef.current,
        finalTranscript.trim(),
        interimTranscript.trim(),
      ].filter(Boolean);

      handleChange("observations", parts.join("\n"));
    };

    recognition.onerror = (event) => {
      console.error("Error en dictado por voz:", event.error);

      if (event.error === "not-allowed") {
        toast.error(
          "No se habilitó el micrófono. Revisá los permisos del navegador.",
        );
      } else {
        toast.error("No se pudo usar el dictado por voz.");
      }

      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      baseObservationTextRef.current = "";
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    toast.success("Dictado activado. Hablá para completar Observaciones.");
  };

  const stopVoiceDictation = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    toast.success("Dictado detenido");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!hasAtLeastOneValue()) {
      toast.error("Cargá al menos un dato para guardar la orden de trabajo");
      return;
    }

    recognitionRef.current?.stop();
    setIsListening(false);
    setSaving(true);

    try {
      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          spare_part_code: null,
          units: null,
          amount: formData.amount ? Number(formData.amount) : null,
          observations: buildObservationsWithCurrency(
            formData.observations,
            formData.amount_currency,
          ),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear orden de trabajo");
      }

      toast.success("Orden de trabajo creada correctamente");
      router.push("/dashboard/taller/ordenes-trabajo");
      router.refresh();
    } catch (error) {
      console.error("Error creating work order:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al crear orden de trabajo",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Button
        type="button"
        variant="ghost"
        onClick={() => router.push("/dashboard/taller/ordenes-trabajo")}
        className="-ml-2 gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al registro
      </Button>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Información básica</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Field label="N° orden de trabajo">
              <Input
                value={formData.order_number}
                onChange={(event) =>
                  handleChange("order_number", event.target.value)
                }
                placeholder="Ej: 1"
              />
            </Field>

            <Field label="Fecha de ingreso">
              <Input
                type="date"
                value={formData.entry_date}
                onChange={(event) =>
                  handleChange("entry_date", event.target.value)
                }
              />
            </Field>

            <ComboField
              label="Estado"
              value={formData.status}
              onChange={(value) => handleChange("status", value)}
              options={STATUS_OPTIONS}
              placeholder="Seleccione o escriba"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ComboField
              label="Área solicitante"
              value={formData.requesting_area}
              onChange={(value) => handleChange("requesting_area", value)}
              options={AREA_SOLICITANTE_OPTIONS}
              placeholder="Ej: GIRSU"
            />

            <ComboField
              label="Tipo de reparación"
              value={formData.repair_type}
              onChange={(value) => handleChange("repair_type", value)}
              options={REPAIR_TYPE_OPTIONS}
              placeholder="Seleccione o escriba"
            />
          </div>

          <ComboField
            label="Reporte de falla"
            value={formData.failure_report}
            onChange={(value) => handleChange("failure_report", value)}
            options={FAILURE_REPORT_OPTIONS}
            placeholder="Si / No"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Vehículo y falla</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ComboField
              label="Código de vehículo"
              value={formData.vehicle_code}
              onChange={handleVehicleCodeChange}
              options={vehicleCodeOptions}
              placeholder="Ej: RD.4"
            />

            <ComboField
              label="Vehículo"
              value={formData.vehicle}
              onChange={handleVehicleNameChange}
              options={vehicleNameOptions}
              placeholder="Ej: IVECO"
            />

            <Field label="Dominio">
              <Input
                value={formData.license_plate}
                onChange={(event) =>
                  handleChange("license_plate", event.target.value)
                }
                placeholder="Ej: AB123CD"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <CriticalityField value={formData.criticality} />

            <ComboField
              label="Tipo de falla"
              value={formData.failure_type}
              onChange={(value) => handleChange("failure_type", value)}
              options={TIPO_FALLA_OPTIONS}
              placeholder="Ej: Alternador"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ComboField
              label="Localización de falla"
              value={formData.failure_location}
              onChange={(value) => handleChange("failure_location", value)}
              options={LOCALIZACION_FALLA_OPTIONS}
              placeholder="Ej: Motor"
            />

            <Field label="Fecha de salida">
              <Input
                type="date"
                value={formData.exit_date}
                onChange={(event) =>
                  handleChange("exit_date", event.target.value)
                }
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Repuestos y proveedor</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ComboField
              label="Requiere repuesto"
              value={formData.requires_spare_part}
              onChange={(value) => handleChange("requires_spare_part", value)}
              options={REQUIRES_SPARE_PART_OPTIONS}
              placeholder="SI / NO"
            />

            <Field label="Detalle de repuesto">
              <Input
                value={formData.spare_part_detail}
                onChange={(event) =>
                  handleChange("spare_part_detail", event.target.value)
                }
                placeholder="Ej: Batería, filtro, manguera..."
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <MultiProviderField
              label="Proveedor/es"
              value={formData.provider}
              onChange={(value) => handleChange("provider", value)}
              options={providerOptions}
              placeholder="Seleccione o escriba un proveedor"
            />

            <Field label="Moneda">
              <select
                value={formData.amount_currency}
                onChange={(event) => handleCurrencyChange(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="ARS">Pesos argentinos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </Field>

            <Field label="Monto">
              <Input
                type="number"
                inputMode="decimal"
                value={formData.amount}
                onChange={(event) => handleChange("amount", event.target.value)}
                placeholder={formData.amount_currency === "USD" ? "Ej: 120" : "Ej: 150000"}
              />
            </Field>
          </div>

          <ComboField
            label="Chofer"
            value={formData.driver}
            onChange={(value) => handleChange("driver", value)}
            options={DRIVER_OPTIONS}
            placeholder="Chofer"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Observaciones</CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="observations">Detalle / observaciones</Label>

              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="sm"
                onClick={isListening ? stopVoiceDictation : startVoiceDictation}
                disabled={!voiceSupported || saving}
                className="w-full gap-2 sm:w-auto"
                title={
                  voiceSupported
                    ? "Dictar observaciones por voz"
                    : "Tu navegador no permite dictado por voz"
                }
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    Detener dictado
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Dictar por voz
                  </>
                )}
              </Button>
            </div>

            <textarea
              id="observations"
              value={formData.observations}
              onChange={(event) =>
                handleChange("observations", event.target.value)
              }
              rows={5}
              placeholder="Escribí observaciones de la orden de trabajo o usá el dictado por voz..."
              className="w-full min-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />

            <p className="text-xs text-muted-foreground">
              La moneda del monto se guarda automáticamente junto con la OT sin
              modificar la base de datos.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-20 -mx-6 border-t bg-background/95 px-6 py-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/taller/ordenes-trabajo")}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={saving}
            className="w-full gap-2 sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Guardar OT
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CriticalityField({ value }: { value: string }) {
  const criticality = getCriticalityValue(value);

  return (
    <div className="space-y-2">
      <Label>Criticidad</Label>

      <div
        className={`flex h-10 items-center rounded-md border px-3 text-sm font-semibold ${getCriticalityClass(
          criticality,
        )}`}
      >
        {criticality}
      </div>
    </div>
  );
}

function MultiProviderField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const providers = useMemo(() => {
    return String(value || "")
      .split("|")
      .map((provider) => provider.trim())
      .filter(Boolean);
  }, [value]);

  const addProvider = (providerValue: string) => {
    const cleanProvider = providerValue.trim();

    if (!cleanProvider) return;

    const exists = providers.some(
      (provider) => normalizeText(provider) === normalizeText(cleanProvider),
    );

    if (exists) {
      setDraft("");
      return;
    }

    onChange([...providers, cleanProvider].join(" | "));
    setDraft("");
  };

  const removeProvider = (providerValue: string) => {
    onChange(
      providers
        .filter(
          (provider) =>
            normalizeText(provider) !== normalizeText(providerValue),
        )
        .join(" | "),
    );
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="space-y-2">
        {providers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {providers.map((provider) => (
              <span
                key={provider}
                className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs font-medium"
              >
                {provider}

                <button
                  type="button"
                  onClick={() => removeProvider(provider)}
                  className="rounded-full text-muted-foreground hover:text-destructive"
                  aria-label={`Quitar proveedor ${provider}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <ComboInput
              value={draft}
              onChange={setDraft}
              onSelect={addProvider}
              options={options}
              placeholder={placeholder}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => addProvider(draft)}
            className="h-10 shrink-0 gap-2"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Podés agregar uno o varios proveedores.
        </p>
      </div>
    </div>
  );
}

function ComboInput({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const uniqueOptions = useMemo(() => getUniqueOptions(options), [options]);

  const visibleOptions = useMemo(() => {
    const query = normalizeText(value);

    if (!query) {
      return uniqueOptions;
    }

    return uniqueOptions.filter((option) =>
      normalizeText(option).includes(query),
    );
  }, [uniqueOptions, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSelect(value);
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="h-10 pr-10"
        />

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Abrir proveedores"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-[80] mt-1 max-h-[260px] w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
                className="flex min-h-9 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="break-words leading-snug">{option}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No se encontraron opciones
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComboField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const uniqueOptions = useMemo(() => getUniqueOptions(options), [options]);

  const visibleOptions = useMemo(() => {
    const query = normalizeText(searchText);

    if (!query) {
      return uniqueOptions;
    }

    return uniqueOptions.filter((option) =>
      normalizeText(option).includes(query),
    );
  }, [uniqueOptions, searchText]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchText("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const openDropdown = () => {
    setSearchText("");
    setIsOpen(true);
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchText("");
    setIsOpen(false);
  };

  return (
    <Field label={label}>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Input
            value={isOpen && searchText ? searchText : value}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchText(nextValue);
              onChange(nextValue);
              setIsOpen(true);
            }}
            onFocus={openDropdown}
            placeholder={placeholder}
            autoComplete="off"
            className="h-10 pr-10"
          />

          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setSearchText("");
              } else {
                openDropdown();
              }
            }}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={`Abrir opciones de ${label}`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {isOpen && (
          <div className="absolute z-[80] mt-1 max-h-[260px] w-full overflow-y-auto rounded-md border border-border bg-background shadow-lg">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => {
                const isSelected =
                  normalizeText(option) === normalizeText(value);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`flex min-h-9 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      isSelected ? "bg-muted" : ""
                    }`}
                  >
                    <span className="break-words leading-snug">{option}</span>

                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No se encontraron opciones
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
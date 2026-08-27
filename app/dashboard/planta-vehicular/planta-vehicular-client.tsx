"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

import {
  Car,
  Check,
  ChevronsUpDown,
  CircleOff,
  FileText,
  Gauge,
  Info,
  Loader2,
  Plus,
  Search,
  Truck,
  Wrench,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PdfDocument = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

const loadImageAsDataUrl = (
  src: string,
): Promise<string> => {
  return new Promise(
    (resolve, reject) => {
      const image = new Image();

      image.crossOrigin =
        "anonymous";

      image.onload = () => {
        const canvas =
          document.createElement(
            "canvas",
          );

        const originalWidth =
          image.naturalWidth ||
          image.width;

        const originalHeight =
          image.naturalHeight ||
          image.height;

        const maxWidth = 500;

        const targetWidth =
          Math.min(
            originalWidth,
            maxWidth,
          );

        const scale =
          originalWidth > 0
            ? targetWidth /
              originalWidth
            : 1;

        const targetHeight =
          Math.max(
            1,
            Math.round(
              originalHeight *
                scale,
            ),
          );

        canvas.width =
          Math.max(
            1,
            Math.round(
              targetWidth,
            ),
          );

        canvas.height =
          targetHeight;

        const context =
          canvas.getContext("2d");

        if (!context) {
          reject(
            new Error(
              "No se pudo procesar el logo.",
            ),
          );

          return;
        }

        context.fillStyle =
          "#ffffff";

        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height,
        );

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        resolve(
          canvas.toDataURL(
            "image/jpeg",
            0.72,
          ),
        );
      };

      image.onerror = () => {
        reject(
          new Error(
            "No se pudo cargar el logo.",
          ),
        );
      };

      image.src = src;
    },
  );
};

type Vehicle = {
  id: string;

  code: string;
  vehicle: string;
  license_plate: string | null;

  vehicle_type: string | null;
  year: number | null;
  department: string | null;

  operational_status: string | null;

  repair_reason: string | null;
  out_of_service_reason: string | null;
  observations: string | null;

  rfid_tag: string | null;

  has_alltrack: boolean;
  has_ibutton_reader: boolean;
  has_camera: boolean;

  utilization: string | null;
  schedule: string | null;

  primary_driver_1: string | null;
  primary_driver_2: string | null;

  image_path: string | null;
  image_thumb_path: string | null;

  active: boolean;

  deactivation_date: string | null;
  deactivation_reason: string | null;

  created_at: string;
  updated_at: string;
};

type PlantaVehicularClientProps = {
  isReadonly: boolean;
  userRole: string;
};

type VehicleCriticalityStatus =
  | "BUENO"
  | "REGULAR"
  | "MALO"
  | "SIN DATOS"
  | "SIN CHECKLIST"
  | "DADO DE BAJA";

type VehicleCriticalitySummary = {
  vehicle_code: string;
  vehicle: string;
  license_plate: string;
  work_orders_count: number;
  mechanical_reliability_score: number;
  service_criticality: number;
  replacement_score: number;
  security_score: number;
  has_checklist: boolean;
  is_retired: boolean;
  total_criticality: number | null;
  notes: string;
  status_label: VehicleCriticalityStatus;
  status_display: string;
};

const ALL_VALUE = "Todos";

const IMAGE_SIGNED_URL_EXPIRES_IN =
  60 * 60 * 24; // 24 horas

const IMAGE_URL_CACHE_TTL =
  60 * 60 * 20 * 1000; // 20 horas

const IMAGE_URL_CACHE_KEY =
  "planta-vehicular-signed-image-urls-v1";

const FILTERS_STORAGE_KEY =
  "planta-vehicular-filters-v1";

type VehicleFiltersState = {
  code: string;
  plate: string;
  status: string;
  department: string;
  type: string;
  active: string;
};

type CachedImageUrl = {
  signedUrl: string;
  expiresAt: number;
};

type ImageUrlCache =
  Record<string, CachedImageUrl>;


const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeVehicleCode = (
  value: unknown,
) =>
  normalizeText(value).replace(
    /[\s.\-]/g,
    "",
  );

const getUniqueValues = (
  values: Array<string | null | undefined>,
) => {
  const unique = new Map<string, string>();

  values.forEach((value) => {
    const cleanValue = String(value || "").trim();

    if (!cleanValue) return;

    const normalizedValue =
      normalizeText(cleanValue);

    if (!unique.has(normalizedValue)) {
      unique.set(
        normalizedValue,
        cleanValue,
      );
    }
  });

  return Array.from(unique.values()).sort(
    (a, b) =>
      a.localeCompare(b, "es", {
        numeric: true,
      }),
  );
};

const getStatusLabel = (
  status?: string | null,
) => {
  const normalized = normalizeText(status);

  if (!normalized) {
    return "Sin estado";
  }

  if (normalized.includes("fuera")) {
    return "Fuera de servicio";
  }

  if (normalized.includes("reparacion")) {
    return "En reparación";
  }

  if (normalized.includes("arreglos")) {
    return "En funcionamiento con arreglos pendientes";
  }

  if (
    normalized.includes("funcionando") ||
    normalized.includes("funcionamiento")
  ) {
    return "Funcionando";
  }

  return String(status);
};

const getStatusBadgeClass = (
  status?: string | null,
) => {
  const normalized = normalizeText(status);

  if (normalized.includes("fuera")) {
    return "border-red-200 bg-red-100 text-red-800";
  }

  if (normalized.includes("reparacion")) {
    return "border-yellow-200 bg-yellow-100 text-yellow-800";
  }

  if (normalized.includes("arreglos")) {
    return "border-orange-200 bg-orange-100 text-orange-800";
  }

  if (
    normalized.includes("funcionando") ||
    normalized.includes("funcionamiento")
  ) {
    return "border-green-200 bg-green-100 text-green-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
};

const formatDate = (
  value?: string | null,
) => {
  if (!value) return "-";

  const [year, month, day] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Date(
    year,
    month - 1,
    day,
  ).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};


type VehicleCardDetail = {
  label: string;
  value: string;
  tone:
    | "repair"
    | "warning"
    | "danger"
    | "info";
};

const getVehicleCardDetail = (
  vehicle: Vehicle,
): VehicleCardDetail | null => {
  if (!vehicle.active) {
    return null;
  }

  const status = normalizeText(
    vehicle.operational_status,
  );

  const repairReason =
    vehicle.repair_reason?.trim();

  const outOfServiceReason =
    vehicle.out_of_service_reason?.trim();

  const observations =
    vehicle.observations?.trim();

  /*
   * Priorizamos el dato más relacionado con el estado actual.
   * Si ese campo no tiene contenido, usamos Observaciones como fallback.
   */
  if (status.includes("reparacion")) {
    const value =
      repairReason ||
      observations;

    return value
      ? {
          label: "Motivo de reparación",
          value,
          tone: "repair",
        }
      : null;
  }

  if (status.includes("arreglos")) {
    const value =
      repairReason ||
      observations;

    return value
      ? {
          label: "Arreglos pendientes",
          value,
          tone: "warning",
        }
      : null;
  }

  if (status.includes("fuera")) {
    const value =
      outOfServiceReason ||
      observations;

    return value
      ? {
          label: "Motivo fuera de servicio",
          value,
          tone: "danger",
        }
      : null;
  }

  /*
   * Si el vehículo está funcionando normalmente pero tiene
   * una observación cargada, también la mostramos.
   */
  if (observations) {
    return {
      label: "Observación",
      value: observations,
      tone: "info",
    };
  }

  return null;
};

const getCriticalityBadgeClass = (
  status?: string | null,
) => {
  const normalized =
    normalizeText(status);

  if (
    normalized === "critico" ||
    normalized === "malo"
  ) {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
  }

  if (normalized === "regular") {
    return "border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-300";
  }

  if (normalized === "bueno") {
    return "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300";
  }

  if (
    normalized === "sin checklist"
  ) {
    return "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300";
  }

  return "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
};

const preloadImageUrls = async (
  urls: string[],
  timeoutMs = 2500,
) => {
  if (
    typeof window === "undefined" ||
    urls.length === 0
  ) {
    return;
  }

  const preloadPromise = Promise.allSettled(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();

          image.onload = () => resolve();
          image.onerror = () => resolve();

          image.src = url;
        }),
    ),
  );

  const timeoutPromise =
    new Promise<void>((resolve) => {
      window.setTimeout(
        resolve,
        timeoutMs,
      );
    });

  await Promise.race([
    preloadPromise,
    timeoutPromise,
  ]);
};

const readImageUrlCache = (): ImageUrlCache => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        IMAGE_URL_CACHE_KEY,
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(raw) as ImageUrlCache;

    const now = Date.now();

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) =>
          Boolean(value?.signedUrl) &&
          value.expiresAt > now,
      ),
    );
  } catch {
    return {};
  }
};

const writeImageUrlCache = (
  cache: ImageUrlCache,
) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      IMAGE_URL_CACHE_KEY,
      JSON.stringify(cache),
    );
  } catch {
    // Si sessionStorage no está disponible, seguimos sin cache local.
  }
};


type SearchableFilterSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  allLabel: string;
  placeholder: string;
};

function SearchableFilterSelect({
  value,
  onValueChange,
  options,
  allLabel,
  placeholder,
}: SearchableFilterSelectProps) {
  const [open, setOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(() => {
    const handlePointerDown = (
      event: MouseEvent,
    ) => {
      if (
        !containerRef.current
          ?.contains(
            event.target as Node,
          )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filteredOptions =
    useMemo(() => {
      const normalizedQuery =
        normalizeText(query);

      if (!normalizedQuery) {
        return options;
      }

      return options.filter(
        (option) =>
          normalizeText(
            option,
          ).includes(
            normalizedQuery,
          ),
      );
    }, [
      options,
      query,
    ]);

  const selectedLabel =
    value === ALL_VALUE
      ? allLabel
      : value;

  const handleSelect = (
    nextValue: string,
  ) => {
    onValueChange(nextValue);
    setOpen(false);
    setQuery("");
  };

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) =>
              !current,
          )
        }
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <span className="truncate">
          {selectedLabel ||
            placeholder}
        </span>

        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[250px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                autoFocus
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value,
                  )
                }
                placeholder={placeholder}
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() =>
                handleSelect(
                  ALL_VALUE,
                )
              }
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
            >
              <Check
                className={[
                  "h-4 w-4",
                  value ===
                  ALL_VALUE
                    ? "opacity-100"
                    : "opacity-0",
                ].join(" ")}
              />

              <span className="truncate">
                {allLabel}
              </span>
            </button>

            {filteredOptions.length >
            0 ? (
              filteredOptions.map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      handleSelect(
                        option,
                      )
                    }
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Check
                      className={[
                        "h-4 w-4",
                        value ===
                        option
                          ? "opacity-100"
                          : "opacity-0",
                      ].join(" ")}
                    />

                    <span className="truncate">
                      {option}
                    </span>
                  </button>
                ),
              )
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No se encontraron
                resultados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlantaVehicularClient({
  isReadonly,
  userRole,
}: PlantaVehicularClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [
    navigationLoading,
    setNavigationLoading,
  ] = useState(false);

  /*
   * Mismo patrón que usa el Navbar:
   * mostramos PageLoader antes de navegar y lo apagamos
   * automáticamente cuando cambia el pathname.
   */
  useEffect(() => {
    setNavigationLoading(false);
  }, [pathname]);

  const navigateWithLoader = (
    href: string,
  ) => {
    if (pathname === href) {
      return;
    }

    setNavigationLoading(true);
    router.push(href);
  };

  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [
    criticalityByVehicle,
    setCriticalityByVehicle,
  ] = useState<
    Record<string, VehicleCriticalitySummary>
  >({});

  const [
    criticalityLoading,
    setCriticalityLoading,
  ] = useState(true);

  const [vehicleImageUrls, setVehicleImageUrls] =
    useState<Record<string, string>>({});

  const [loading, setLoading] =
    useState(true);

  /*
   * Loader inicial de Planta Vehicular.
   * Se mantiene visible mientras llegan los vehículos
   * y se precargan las primeras imágenes del catálogo.
   */
  const [
    initialPageLoading,
    setInitialPageLoading,
  ] = useState(true);

  const [
    isExportingPdf,
    setIsExportingPdf,
  ] = useState(false);

  const [codeFilter, setCodeFilter] =
    useState(ALL_VALUE);

  const [plateFilter, setPlateFilter] =
    useState(ALL_VALUE);

  const [statusFilter, setStatusFilter] =
    useState(ALL_VALUE);

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState(ALL_VALUE);

  const [typeFilter, setTypeFilter] =
    useState(ALL_VALUE);

  const [activeFilter, setActiveFilter] =
    useState("Activos");

  const [
    filtersInitialized,
    setFiltersInitialized,
  ] = useState(false);

  /*
   * =========================================================
   * FILTROS PERSISTENTES
   * =========================================================
   *
   * 1. La URL es la fuente visible:
   *    ?codigo=A.6&estado=Funcionando&direccion=GIRSU
   *
   * 2. sessionStorage actúa como respaldo para que, si se entra
   *    a una ficha y se vuelve con un enlace limpio a
   *    /dashboard/planta-vehicular, tampoco se pierdan.
   *
   * 3. Los valores por defecto no se agregan a la URL.
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search,
      );

    const hasUrlFilters =
      [
        "codigo",
        "dominio",
        "estado",
        "direccion",
        "tipo",
        "situacion",
      ].some((key) => params.has(key));

    let nextFilters: VehicleFiltersState = {
      code: ALL_VALUE,
      plate: ALL_VALUE,
      status: ALL_VALUE,
      department: ALL_VALUE,
      type: ALL_VALUE,
      active: "Activos",
    };

    if (hasUrlFilters) {
      nextFilters = {
        code:
          params.get("codigo") ||
          ALL_VALUE,
        plate:
          params.get("dominio") ||
          ALL_VALUE,
        status:
          params.get("estado") ||
          ALL_VALUE,
        department:
          params.get("direccion") ||
          ALL_VALUE,
        type:
          params.get("tipo") ||
          ALL_VALUE,
        active:
          params.get("situacion") ||
          "Activos",
      };
    } else {
      try {
        const saved =
          window.sessionStorage.getItem(
            FILTERS_STORAGE_KEY,
          );

        if (saved) {
          const parsed =
            JSON.parse(
              saved,
            ) as Partial<VehicleFiltersState>;

          nextFilters = {
            code:
              parsed.code ||
              ALL_VALUE,
            plate:
              parsed.plate ||
              ALL_VALUE,
            status:
              parsed.status ||
              ALL_VALUE,
            department:
              parsed.department ||
              ALL_VALUE,
            type:
              parsed.type ||
              ALL_VALUE,
            active:
              parsed.active ||
              "Activos",
          };
        }
      } catch {
        // Si sessionStorage no está disponible, seguimos con defaults.
      }
    }

    setCodeFilter(nextFilters.code);
    setPlateFilter(nextFilters.plate);
    setStatusFilter(
      nextFilters.status,
    );
    setDepartmentFilter(
      nextFilters.department,
    );
    setTypeFilter(nextFilters.type);
    setActiveFilter(nextFilters.active);

    setFiltersInitialized(true);
  }, []);

  useEffect(() => {
    if (
      !filtersInitialized ||
      typeof window === "undefined"
    ) {
      return;
    }

    const currentFilters: VehicleFiltersState = {
      code: codeFilter,
      plate: plateFilter,
      status: statusFilter,
      department: departmentFilter,
      type: typeFilter,
      active: activeFilter,
    };

    try {
      window.sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify(
          currentFilters,
        ),
      );
    } catch {
      // La URL seguirá funcionando aunque no haya sessionStorage.
    }

    const params =
      new URLSearchParams();

    if (codeFilter !== ALL_VALUE) {
      params.set(
        "codigo",
        codeFilter,
      );
    }

    if (plateFilter !== ALL_VALUE) {
      params.set(
        "dominio",
        plateFilter,
      );
    }

    if (statusFilter !== ALL_VALUE) {
      params.set(
        "estado",
        statusFilter,
      );
    }

    if (
      departmentFilter !== ALL_VALUE
    ) {
      params.set(
        "direccion",
        departmentFilter,
      );
    }

    if (typeFilter !== ALL_VALUE) {
      params.set(
        "tipo",
        typeFilter,
      );
    }

    if (activeFilter !== "Activos") {
      params.set(
        "situacion",
        activeFilter,
      );
    }

    const query =
      params.toString();

    const nextUrl = query
      ? `${pathname}?${query}`
      : pathname;

    const currentUrl =
      `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== nextUrl) {
      router.replace(
        nextUrl,
        {
          scroll: false,
        },
      );
    }
  }, [
    filtersInitialized,
    codeFilter,
    plateFilter,
    statusFilter,
    departmentFilter,
    typeFilter,
    activeFilter,
    pathname,
    router,
  ]);

  const fetchCriticality = async () => {
    try {
      setCriticalityLoading(true);

      const response = await fetch(
        "/api/taller/criticidad/resumen",
        {
          cache: "no-store",
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "No se pudo cargar la criticidad vehicular",
        );
      }

      const rows =
        (result?.data ||
          []) as VehicleCriticalitySummary[];

      const nextMap:
        Record<
          string,
          VehicleCriticalitySummary
        > = {};

      rows.forEach((row) => {
        const key =
          normalizeVehicleCode(
            row.vehicle_code,
          );

        if (!key) {
          return;
        }

        nextMap[key] = row;
      });

      setCriticalityByVehicle(
        nextMap,
      );
    } catch (error) {
      console.error(
        "Error cargando criticidad en Planta Vehicular:",
        error,
      );

      /*
       * No bloqueamos Planta Vehicular si Taller no responde.
       * Simplemente los cards mostrarán "Sin datos".
       */
      setCriticalityByVehicle({});
    } finally {
      setCriticalityLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      setInitialPageLoading(true);

      const supabase = createClient();

      const { data, error } =
        await supabase
          .from("vehicles")
          .select("*")
          .order("code", {
            ascending: true,
          });

      if (error) {
        throw error;
      }

      const vehicleRows =
        (data || []) as Vehicle[];

      setVehicles(vehicleRows);
      setLoading(false);

      const vehiclesWithImages =
        vehicleRows.filter(
          (vehicle) =>
            Boolean(
              vehicle.image_thumb_path ||
                vehicle.image_path,
            ),
        );

      if (
        vehiclesWithImages.length === 0
      ) {
        setVehicleImageUrls({});
        setInitialPageLoading(false);
        return;
      }

      const cachedUrls =
        readImageUrlCache();

      const imageUrlMap:
        Record<string, string> = {};

      const missingVehicles: Vehicle[] = [];

      vehiclesWithImages.forEach(
        (vehicle) => {
          const imagePath =
            (
              vehicle.image_thumb_path ||
              vehicle.image_path
            )!;

          const cached =
            cachedUrls[imagePath];

          if (cached?.signedUrl) {
            imageUrlMap[vehicle.id] =
              cached.signedUrl;
          } else {
            missingVehicles.push(vehicle);
          }
        },
      );

      if (
        Object.keys(imageUrlMap).length > 0
      ) {
        setVehicleImageUrls({
          ...imageUrlMap,
        });
      }

      if (
        missingVehicles.length > 0
      ) {
        const missingPaths =
          missingVehicles.map(
            (vehicle) =>
              (
                vehicle.image_thumb_path ||
                vehicle.image_path
              )!,
          );

        const {
          data: signedImages,
          error: signedImagesError,
        } = await supabase.storage
          .from("vehicle-images")
          .createSignedUrls(
            missingPaths,
            IMAGE_SIGNED_URL_EXPIRES_IN,
          );

        if (signedImagesError) {
          throw signedImagesError;
        }

        const nextCache = {
          ...cachedUrls,
        };

        missingVehicles.forEach(
          (vehicle, index) => {
            const signedUrl =
              signedImages?.[index]
                ?.signedUrl;

            if (!signedUrl) {
              console.error(
                `No se pudo generar la URL de la imagen de ${vehicle.code}`,
              );
              return;
            }

            const imagePath =
              (
                vehicle.image_thumb_path ||
                vehicle.image_path
              )!;

            imageUrlMap[vehicle.id] =
              signedUrl;

            nextCache[imagePath] = {
              signedUrl,
              expiresAt:
                Date.now() +
                IMAGE_URL_CACHE_TTL,
            };
          },
        );

        writeImageUrlCache(nextCache);

        setVehicleImageUrls({
          ...imageUrlMap,
        });
      }

      /*
       * Antes de sacar el PageLoader, precargamos
       * las primeras imágenes visibles del catálogo.
       * Máximo 8 y con timeout, para evitar que quede
       * cargando infinitamente.
       */
      const initialImageUrls =
        vehicleRows
          .map(
            (vehicle) =>
              imageUrlMap[vehicle.id],
          )
          .filter(
            (url): url is string =>
              Boolean(url),
          )
          .slice(0, 8);

      await preloadImageUrls(
        initialImageUrls,
        2500,
      );
    } catch (error) {
      console.error(
        "Error cargando Planta Vehicular:",
        error,
      );

      setLoading(false);
    } finally {
      setInitialPageLoading(false);
    }
  };

  useEffect(() => {
    void fetchVehicles();
    void fetchCriticality();

    /*
     * La criticidad no se guarda en vehicles:
     * cada vez que el usuario vuelve a esta pestaña,
     * refrescamos el resumen desde Taller.
     */
    const handleWindowFocus = () => {
      void fetchCriticality();
    };

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void fetchCriticality();
        }
      };

    window.addEventListener(
      "focus",
      handleWindowFocus,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleWindowFocus,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, []);

  const statusOptions = useMemo(
    () =>
      getUniqueValues(
        vehicles.map((vehicle) =>
          getStatusLabel(
            vehicle.operational_status,
          ),
        ),
      ),
    [vehicles],
  );

  const codeOptions = useMemo(
    () =>
      getUniqueValues(
        vehicles.map(
          (vehicle) =>
            vehicle.code,
        ),
      ),
    [vehicles],
  );

  const plateOptions = useMemo(
    () =>
      getUniqueValues(
        vehicles.map(
          (vehicle) =>
            vehicle.license_plate,
        ),
      ),
    [vehicles],
  );

  const departmentOptions =
    useMemo(
      () =>
        getUniqueValues(
          vehicles.map(
            (vehicle) =>
              vehicle.department,
          ),
        ),
      [vehicles],
    );

  const typeOptions = useMemo(
    () =>
      getUniqueValues(
        vehicles.map(
          (vehicle) =>
            vehicle.vehicle_type,
        ),
      ),
    [vehicles],
  );

  const filteredVehicles =
    useMemo(() => {
      return vehicles.filter(
        (vehicle) => {
          const vehicleStatus =
            getStatusLabel(
              vehicle.operational_status,
            );

          const matchesCode =
            codeFilter === ALL_VALUE ||
            normalizeText(
              vehicle.code,
            ) ===
              normalizeText(
                codeFilter,
              );

          const matchesPlate =
            plateFilter === ALL_VALUE ||
            normalizeText(
              vehicle.license_plate,
            ) ===
              normalizeText(
                plateFilter,
              );

          const matchesStatus =
            statusFilter ===
              ALL_VALUE ||
            normalizeText(
              vehicleStatus,
            ) ===
              normalizeText(
                statusFilter,
              );

          const matchesDepartment =
            departmentFilter ===
              ALL_VALUE ||
            normalizeText(
              vehicle.department,
            ) ===
              normalizeText(
                departmentFilter,
              );

          const matchesType =
            typeFilter === ALL_VALUE ||
            normalizeText(
              vehicle.vehicle_type,
            ) ===
              normalizeText(
                typeFilter,
              );

          const matchesActive =
            activeFilter === "Todos" ||
            (activeFilter ===
              "Activos" &&
              vehicle.active) ||
            (activeFilter ===
              "Dados de baja" &&
              !vehicle.active);

          return (
            matchesCode &&
            matchesPlate &&
            matchesStatus &&
            matchesDepartment &&
            matchesType &&
            matchesActive
          );
        },
      );
    }, [
      vehicles,
      codeFilter,
      plateFilter,
      statusFilter,
      departmentFilter,
      typeFilter,
      activeFilter,
    ]);


  const activeVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) => vehicle.active,
      ),
    [vehicles],
  );

  const deactivatedVehicles =
    useMemo(
      () =>
        vehicles.filter(
          (vehicle) =>
            !vehicle.active,
        ),
      [vehicles],
    );

  const totalActive =
    activeVehicles.length;

  const deactivatedCount =
    deactivatedVehicles.length;

  const functioningCount =
    activeVehicles.filter(
      (vehicle) =>
        normalizeText(
          getStatusLabel(
            vehicle.operational_status,
          ),
        ) ===
        normalizeText(
          "Funcionando",
        ),
    ).length;

  const pendingRepairsCount =
    activeVehicles.filter(
      (vehicle) =>
        normalizeText(
          getStatusLabel(
            vehicle.operational_status,
          ),
        ) ===
        normalizeText(
          "En funcionamiento con arreglos pendientes",
        ),
    ).length;

  const repairCount =
    activeVehicles.filter(
      (vehicle) =>
        normalizeText(
          getStatusLabel(
            vehicle.operational_status,
          ),
        ) ===
        normalizeText(
          "En reparación",
        ),
    ).length;

  const outOfServiceCount =
    activeVehicles.filter(
      (vehicle) =>
        normalizeText(
          getStatusLabel(
            vehicle.operational_status,
          ),
        ) ===
        normalizeText(
          "Fuera de servicio",
        ),
    ).length;

  const applyActiveFilter = () => {
    setActiveFilter("Activos");
    setStatusFilter(ALL_VALUE);
  };

  const applyStatusFilter = (
    status: string,
  ) => {
    setActiveFilter("Activos");
    setStatusFilter(status);
  };

  const applyDeactivatedFilter =
    () => {
      setActiveFilter(
        "Dados de baja",
      );
      setStatusFilter(ALL_VALUE);
    };

  const clearFilters = () => {
    setCodeFilter(ALL_VALUE);
    setPlateFilter(ALL_VALUE);
    setStatusFilter(ALL_VALUE);
    setDepartmentFilter(ALL_VALUE);
    setTypeFilter(ALL_VALUE);
    setActiveFilter("Activos");

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(
          FILTERS_STORAGE_KEY,
        );
      } catch {
        // Sin sessionStorage, la URL igualmente queda limpia.
      }
    }
  };

  const hasFilters =
    codeFilter !== ALL_VALUE ||
    plateFilter !== ALL_VALUE ||
    statusFilter !== ALL_VALUE ||
    departmentFilter !== ALL_VALUE ||
    typeFilter !== ALL_VALUE ||
    activeFilter !== "Activos";

  const getPdfFilterSummary = () => {
    const filters: string[] = [];

    if (codeFilter !== ALL_VALUE) {
      filters.push(
        `Código: ${codeFilter}`,
      );
    }

    if (plateFilter !== ALL_VALUE) {
      filters.push(
        `Dominio: ${plateFilter}`,
      );
    }

    if (statusFilter !== ALL_VALUE) {
      filters.push(
        `Estado: ${statusFilter}`,
      );
    }

    if (
      departmentFilter !==
      ALL_VALUE
    ) {
      filters.push(
        `Dirección: ${departmentFilter}`,
      );
    }

    if (typeFilter !== ALL_VALUE) {
      filters.push(
        `Tipo: ${typeFilter}`,
      );
    }

    if (
      activeFilter !== "Activos"
    ) {
      filters.push(
        `Situación: ${activeFilter}`,
      );
    }

    return filters.length > 0
      ? filters.join(" · ")
      : "Sin filtros adicionales";
  };

  const exportToPdf = async () => {
    if (
      filteredVehicles.length === 0
    ) {
      toast.error(
        "No hay vehículos para exportar con los filtros actuales.",
      );

      return;
    }

    if (isExportingPdf) {
      return;
    }

    setIsExportingPdf(true);

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      }) as PdfDocument;

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      const marginX = 12;

      let logoDataUrl:
        | string
        | null = null;

      try {
        logoDataUrl =
          await loadImageAsDataUrl(
            "/logo-general-pico-horizontal.png",
          );
      } catch (error) {
        console.warn(
          "No se pudo cargar el logo para el PDF:",
          error,
        );
      }

      if (logoDataUrl) {
        doc.addImage(
          logoDataUrl,
          "JPEG",
          marginX,
          8,
          34,
          12,
          undefined,
          "FAST",
        );
      }

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setFontSize(17);
      doc.setTextColor(
        30,
        41,
        59,
      );

      doc.text(
        "Planta Vehicular",
        50,
        13,
      );

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(9.5);
      doc.setTextColor(
        71,
        85,
        105,
      );

      doc.text(
        "Secretaría de Ambiente y Servicios Públicos",
        50,
        19,
      );

      doc.setFontSize(8.5);

      doc.text(
        `Filtros: ${getPdfFilterSummary()}`,
        marginX,
        29,
        {
          maxWidth:
            pageWidth -
            marginX * 2,
        },
      );

      doc.text(
        `Fecha de exportación: ${new Date().toLocaleString(
          "es-AR",
        )}`,
        marginX,
        35,
      );

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setFontSize(11.5);
      doc.setTextColor(
        30,
        41,
        59,
      );

      doc.text(
        "Resumen",
        marginX,
        44,
      );

      const filteredActive =
        filteredVehicles.filter(
          (vehicle) =>
            vehicle.active,
        );

      const filteredDeactivated =
        filteredVehicles.filter(
          (vehicle) =>
            !vehicle.active,
        );

      const filteredFunctioning =
        filteredActive.filter(
          (vehicle) =>
            normalizeText(
              getStatusLabel(
                vehicle.operational_status,
              ),
            ) ===
            normalizeText(
              "Funcionando",
            ),
        ).length;

      const filteredPending =
        filteredActive.filter(
          (vehicle) =>
            normalizeText(
              getStatusLabel(
                vehicle.operational_status,
              ),
            ) ===
            normalizeText(
              "En funcionamiento con arreglos pendientes",
            ),
        ).length;

      const filteredRepair =
        filteredActive.filter(
          (vehicle) =>
            normalizeText(
              getStatusLabel(
                vehicle.operational_status,
              ),
            ) ===
            normalizeText(
              "En reparación",
            ),
        ).length;

      const filteredOutOfService =
        filteredActive.filter(
          (vehicle) =>
            normalizeText(
              getStatusLabel(
                vehicle.operational_status,
              ),
            ) ===
            normalizeText(
              "Fuera de servicio",
            ),
        ).length;

      autoTable(doc, {
        startY: 47,
        head: [[
          "Vehículos",
          "Activos",
          "Funcionando",
          "Arreglos pend.",
          "En reparación",
          "Fuera servicio",
          "Dados de baja",
        ]],
        body: [[
          filteredVehicles.length,
          filteredActive.length,
          filteredFunctioning,
          filteredPending,
          filteredRepair,
          filteredOutOfService,
          filteredDeactivated.length,
        ]],
        theme: "grid",
        margin: {
          left: marginX,
          right: marginX,
        },
        styles: {
          fontSize: 8.2,
          cellPadding: 2.2,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.15,
          halign: "center",
          valign: "middle",
        },
        headStyles: {
          fillColor: [5, 150, 105],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          fontStyle: "bold",
        },
      });

      const detailTitleY =
        (doc.lastAutoTable?.finalY ?? 47) + 8;

      doc.setFont(
        "helvetica",
        "bold",
      );

      doc.setFontSize(11.5);
      doc.setTextColor(
        30,
        41,
        59,
      );

      doc.text(
        "Detalle de vehículos",
        marginX,
        detailTitleY,
      );

      doc.setFont(
        "helvetica",
        "normal",
      );

      doc.setFontSize(8.5);
      doc.setTextColor(
        71,
        85,
        105,
      );

      doc.text(
        `${filteredVehicles.length} vehículo${
          filteredVehicles.length === 1
            ? ""
            : "s"
        } incluidos según los filtros aplicados.`,
        marginX,
        detailTitleY + 6,
      );

      const vehicleRows =
        filteredVehicles.map(
          (vehicle) => {
            return [
              vehicle.code || "-",
              vehicle.vehicle || "-",
              vehicle.license_plate ||
                "-",
              vehicle.vehicle_type ||
                "-",
              vehicle.year
                ? String(
                    vehicle.year,
                  )
                : "-",
              vehicle.department ||
                "-",
              getStatusLabel(
                vehicle.operational_status,
              ),
              vehicle.observations?.trim() ||
                "-",
            ];
          },
        );

      autoTable(doc, {
        startY: detailTitleY + 10,
        head: [
          [
            "Código",
            "Vehículo",
            "Dominio",
            "Tipo",
            "Año",
            "Dirección",
            "Estado operativo",
            "Observaciones",
          ],
        ],
        body: vehicleRows,
        theme: "grid",
        showHead: "everyPage",
        pageBreak: "auto",
        rowPageBreak: "avoid",
        margin: {
          left: marginX,
          right: marginX,
          top: 18,
          bottom: 16,
        },
        styles: {
          fontSize: 7.1,
          cellPadding: 1.8,
          textColor: [
            51,
            65,
            85,
          ],
          lineColor: [
            226,
            232,
            240,
          ],
          lineWidth: 0.15,
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [
            16,
            185,
            129,
          ],
          textColor: [
            255,
            255,
            255,
          ],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [
            248,
            250,
            252,
          ],
        },
        columnStyles: {
          0: {
            cellWidth: 16,
          },
          1: {
            cellWidth: 40,
          },
          2: {
            cellWidth: 21,
          },
          3: {
            cellWidth: 28,
          },
          4: {
            cellWidth: 13,
            halign: "center",
          },
          5: {
            cellWidth: 29,
          },
          6: {
            cellWidth: 34,
          },
          7: {
            cellWidth: 70,
          },
        },
      });

      const pageCount =
        doc.getNumberOfPages();

      for (
        let pageNumber = 1;
        pageNumber <= pageCount;
        pageNumber += 1
      ) {
        doc.setPage(pageNumber);

        doc.setDrawColor(
          226,
          232,
          240,
        );

        doc.line(
          marginX,
          pageHeight - 13,
          pageWidth - marginX,
          pageHeight - 13,
        );

        doc.setFont(
          "helvetica",
          "normal",
        );

        doc.setFontSize(7.5);
        doc.setTextColor(
          100,
          116,
          139,
        );

        doc.text(
          "Sistema Integral SAySSPP · Planta Vehicular",
          marginX,
          pageHeight - 7,
        );

        doc.text(
          `Página ${pageNumber} de ${pageCount}`,
          pageWidth - marginX,
          pageHeight - 7,
          {
            align: "right",
          },
        );
      }

      const fileDate =
        new Date()
          .toISOString()
          .slice(0, 10);

      doc.save(
        `planta_vehicular_${fileDate}.pdf`,
      );

      toast.success(
        "Planta Vehicular exportada correctamente.",
      );
    } catch (error) {
      console.error(
        "Error al exportar Planta Vehicular:",
        error,
      );

      toast.error(
        "No se pudo exportar Planta Vehicular.",
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      <PageLoader
        show={
          navigationLoading ||
          initialPageLoading
        }
      />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Planta Vehicular
          </h1>

          <p className="mt-2 text-muted-foreground">
            Administración, consulta y
            seguimiento de la flota
            vehicular.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={exportToPdf}
            disabled={
              isExportingPdf ||
              filteredVehicles.length === 0
            }
          >
            {isExportingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}

            {isExportingPdf
              ? "Generando PDF..."
              : "Exportar PDF"}
          </Button>

          {!isReadonly && (
            <Button
              type="button"
              onClick={() =>
                navigateWithLoader(
                  "/dashboard/planta-vehicular/nuevo",
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo vehículo
            </Button>
          )}
        </div>
      </div>

      {isReadonly && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              Estás accediendo en modo
              solo lectura. Podés
              consultar toda la
              información de Planta
              Vehicular, pero no realizar
              modificaciones.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <SummaryCard
          title="Vehículos activos"
          value={totalActive}
          icon={
            <Truck className="h-5 w-5" />
          }
          selected={
            activeFilter ===
              "Activos" &&
            statusFilter ===
              ALL_VALUE
          }
          onClick={
            applyActiveFilter
          }
        />

        <SummaryCard
          title="Funcionando"
          value={functioningCount}
          icon={
            <Car className="h-5 w-5" />
          }
          selected={
            activeFilter ===
              "Activos" &&
            statusFilter ===
              "Funcionando"
          }
          onClick={() =>
            applyStatusFilter(
              "Funcionando",
            )
          }
        />

        <SummaryCard
          title="Arreglos pendientes"
          value={
            pendingRepairsCount
          }
          icon={
            <Wrench className="h-5 w-5" />
          }
          selected={
            activeFilter ===
              "Activos" &&
            statusFilter ===
              "En funcionamiento con arreglos pendientes"
          }
          onClick={() =>
            applyStatusFilter(
              "En funcionamiento con arreglos pendientes",
            )
          }
        />

        <SummaryCard
          title="En reparación"
          value={repairCount}
          icon={
            <Wrench className="h-5 w-5" />
          }
          selected={
            activeFilter ===
              "Activos" &&
            statusFilter ===
              "En reparación"
          }
          onClick={() =>
            applyStatusFilter(
              "En reparación",
            )
          }
        />

        <SummaryCard
          title="Fuera de servicio"
          value={
            outOfServiceCount
          }
          icon={
            <CircleOff className="h-5 w-5" />
          }
          selected={
            activeFilter ===
              "Activos" &&
            statusFilter ===
              "Fuera de servicio"
          }
          onClick={() =>
            applyStatusFilter(
              "Fuera de servicio",
            )
          }
        />

        <SummaryCard
          title="Dados de baja"
          value={
            deactivatedCount
          }
          icon={
            <CircleOff className="h-5 w-5" />
          }
          selected={
            activeFilter ===
              "Dados de baja"
          }
          onClick={
            applyDeactivatedFilter
          }
          danger
        />
      </div>

      <Card className="overflow-visible">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                Buscar y filtrar
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Combiná los filtros para encontrar rápidamente la unidad que necesitás.
              </p>
            </div>

            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-fit shrink-0"
              >
                <X className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {/* =====================================================
              FILTROS
          ====================================================== */}

          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-12">
            {/* CÓDIGO */}
            <div className="min-w-0 space-y-1.5 xl:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Código
              </Label>

              <SearchableFilterSelect
                value={codeFilter}
                onValueChange={setCodeFilter}
                options={codeOptions}
                allLabel="Todos los códigos"
                placeholder="Buscar código..."
              />
            </div>

            {/* DOMINIO */}
            <div className="min-w-0 space-y-1.5 xl:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Dominio
              </Label>

              <SearchableFilterSelect
                value={plateFilter}
                onValueChange={setPlateFilter}
                options={plateOptions}
                allLabel="Todos los dominios"
                placeholder="Buscar dominio..."
              />
            </div>

            {/* ESTADO OPERATIVO */}
            <div className="min-w-0 space-y-1.5 sm:col-span-2 xl:col-span-3">
              <Label className="text-xs font-medium text-muted-foreground">
                Estado operativo
              </Label>

              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    Todos los estados
                  </SelectItem>

                  {statusOptions.map((status) => (
                    <SelectItem
                      key={status}
                      value={status}
                    >
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* DIRECCIÓN */}
            <div className="min-w-0 space-y-1.5 xl:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Dirección
              </Label>

              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Todas las direcciones" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    Todas las direcciones
                  </SelectItem>

                  {departmentOptions.map((department) => (
                    <SelectItem
                      key={department}
                      value={department}
                    >
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* TIPO */}
            <div className="min-w-0 space-y-1.5 xl:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Tipo de vehículo
              </Label>

              <Select
                value={typeFilter}
                onValueChange={setTypeFilter}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={ALL_VALUE}>
                    Todos los tipos
                  </SelectItem>

                  {typeOptions.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                    >
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SITUACIÓN */}
            <div className="min-w-0 space-y-1.5 xl:col-span-1">
              <Label className="text-xs font-medium text-muted-foreground">
                Situación
              </Label>

              <Select
                value={activeFilter}
                onValueChange={setActiveFilter}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="Activos">
                    Activos
                  </SelectItem>

                  <SelectItem value="Dados de baja">
                    Dados de baja
                  </SelectItem>

                  <SelectItem value="Todos">
                    Todos
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* =====================================================
              RESUMEN DE FILTROS
          ====================================================== */}

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {filteredVehicles.length}
              </span>{" "}
              vehículo
              {filteredVehicles.length === 1
                ? ""
                : "s"}{" "}
              encontrado
              {filteredVehicles.length === 1
                ? ""
                : "s"}
            </div>

            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="w-full sm:w-auto"
              >
                <X className="mr-2 h-4 w-4" />
                Restablecer filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex min-h-[250px] items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando Planta
              Vehicular...
            </div>
          </CardContent>
        </Card>
      ) : filteredVehicles.length ===
        0 ? (
        <Card>
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full border p-4">
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                No hay vehículos para
                mostrar
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                {vehicles.length === 0
                  ? "Todavía no hay vehículos cargados en Planta Vehicular."
                  : activeFilter ===
                      "Dados de baja"
                    ? "No hay vehículos dados de baja que coincidan con los filtros seleccionados."
                    : "No encontramos vehículos que coincidan con los filtros seleccionados."}
              </p>
            </div>

            {!isReadonly &&
              vehicles.length === 0 && (
                <Button
                  type="button"
                  onClick={() =>
                    navigateWithLoader(
                      "/dashboard/planta-vehicular/nuevo",
                    )
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Cargar primer vehículo
                </Button>
              )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filteredVehicles.map(
            (vehicle, index) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                imageUrl={
                  vehicleImageUrls[
                    vehicle.id
                  ] || null
                }
                priority={index < 8}
                criticality={
                  criticalityByVehicle[
                    normalizeVehicleCode(
                      vehicle.code,
                    )
                  ] || null
                }
                criticalityLoading={
                  criticalityLoading
                }
                onView={() => {
                  if (
                    typeof window !==
                    "undefined"
                  ) {
                    try {
                      window.sessionStorage.setItem(
                        FILTERS_STORAGE_KEY,
                        JSON.stringify({
                          code: codeFilter,
                          plate: plateFilter,
                          status:
                            statusFilter,
                          department:
                            departmentFilter,
                          type: typeFilter,
                          active:
                            activeFilter,
                        } satisfies VehicleFiltersState),
                      );
                    } catch {
                      // Si falla el storage, la URL actual conserva los filtros.
                    }
                  }

                  navigateWithLoader(
                    `/dashboard/planta-vehicular/${vehicle.id}`,
                  );
                }}
              />
            ),
          )}
        </div>
      )}

      </div>
    </>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  selected = false,
  danger = false,
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  selected?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
    >
      <Card
        className={[
          "h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
          selected
            ? danger
              ? "border-red-400 ring-1 ring-red-300"
              : "border-primary ring-1 ring-primary/30"
            : "",
        ].join(" ")}
      >
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm text-muted-foreground">
              {title}
            </p>

            <p
              className={[
                "mt-1 text-2xl font-bold",
                danger &&
                value > 0
                  ? "text-red-600 dark:text-red-400"
                  : "",
              ].join(" ")}
            >
              {value}
            </p>
          </div>

          <div
            className={[
              "rounded-xl border p-3",
              danger
                ? "border-red-200 text-red-600 dark:border-red-900 dark:text-red-400"
                : "",
            ].join(" ")}
          >
            {icon}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function VehicleCard({
  vehicle,
  imageUrl,
  priority = false,
  criticality,
  criticalityLoading,
  onView,
}: {
  vehicle: Vehicle;
  imageUrl: string | null;
  priority?: boolean;
  criticality:
    | VehicleCriticalitySummary
    | null;
  criticalityLoading: boolean;
  onView: () => void;
}) {
  const cardDetail =
    getVehicleCardDetail(
      vehicle,
    );

  return (
    <Card
      className={[
        "group overflow-hidden rounded-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg",
        !vehicle.active
          ? "border-red-200 dark:border-red-900"
          : "",
      ].join(" ")}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b bg-muted/20">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={`${vehicle.code} - ${vehicle.vehicle}`}
              loading={
                priority
                  ? "eager"
                  : "lazy"
              }
              decoding="async"
              fetchPriority={
                priority
                  ? "high"
                  : "auto"
              }
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground transition-transform duration-300 group-hover:scale-105">
            <Car className="h-10 w-10" />

            <span className="text-[11px]">
              Sin imagen
            </span>
          </div>
        )}
      </div>

      <CardHeader className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight">
              {vehicle.code}
            </CardTitle>

            <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug">
              {vehicle.vehicle}
            </p>
          </div>

          {!vehicle.active && (
            <Badge
              variant="outline"
              className="shrink-0 border-red-200 bg-red-100 text-red-800"
            >
              <CircleOff className="mr-1 h-3.5 w-3.5" />
              Dado de baja
            </Badge>
          )}
        </div>

        {vehicle.active ? (
          <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Estado operativo
            </p>

            <Badge
              variant="outline"
              className={[
                getStatusBadgeClass(
                  vehicle.operational_status,
                ),
                "px-2.5 py-1 text-[13px] font-bold shadow-sm",
              ].join(" ")}
            >
              {getStatusLabel(
                vehicle.operational_status,
              )}
            </Badge>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-2.5 dark:border-red-900 dark:bg-red-950/20">
            <div className="text-sm font-semibold text-red-700 dark:text-red-300">
              Baja
            </div>

            <div className="text-[12px]">
              <span className="text-muted-foreground">
                Fecha:{" "}
              </span>

              <span className="font-medium">
                {formatDate(
                  vehicle.deactivation_date,
                )}
              </span>
            </div>

            <div className="text-[12px]">
              <span className="text-muted-foreground">
                Motivo:{" "}
              </span>

              <span className="font-medium">
                {vehicle.deactivation_reason ||
                  "-"}
              </span>
            </div>
          </div>
        )}

        <VehicleCriticalityDetail
          vehicleActive={
            vehicle.active
          }
          criticality={
            criticality
          }
          loading={
            criticalityLoading
          }
        />

        {cardDetail && (
          <VehicleOperationalDetail
            detail={cardDetail}
          />
        )}
      </CardHeader>

      <CardContent className="space-y-3 px-3 pb-3 pt-0">
        <div className="space-y-1.5 text-[13px]">
          <VehicleInfoRow
            label="Dominio"
            value={
              vehicle.license_plate
            }
          />

          <VehicleInfoRow
            label="Tipo"
            value={
              vehicle.vehicle_type
            }
          />

          <VehicleInfoRow
            label="Año"
            value={
              vehicle.year
                ? String(vehicle.year)
                : null
            }
          />

          <VehicleInfoRow
            label="Dirección"
            value={
              vehicle.department
            }
          />

          {!vehicle.active && (
            <VehicleInfoRow
              label="Último estado"
              value={getStatusLabel(
                vehicle.operational_status,
              )}
            />
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onView}
          className="h-9 w-full transition-colors duration-300 group-hover:border-primary/40 group-hover:bg-primary/5"
        >
          Ver ficha
        </Button>
      </CardContent>
    </Card>
  );
}

function VehicleCriticalityDetail({
  vehicleActive,
  criticality,
  loading,
}: {
  vehicleActive: boolean;
  criticality:
    | VehicleCriticalitySummary
    | null;
  loading: boolean;
}) {
  if (loading && !criticality) {
    return (
      <div className="rounded-lg border bg-muted/20 p-2.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando criticidad...
        </div>
      </div>
    );
  }

  if (!vehicleActive) {
    return (
      <div className="rounded-lg border bg-muted/20 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />

            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Criticidad
            </p>
          </div>

          <Badge
            variant="outline"
            className={getCriticalityBadgeClass(
              "DADO DE BAJA",
            )}
          >
            DADO DE BAJA
          </Badge>
        </div>
      </div>
    );
  }

  if (!criticality) {
    return (
      <div className="rounded-lg border bg-muted/20 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />

            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Criticidad
            </p>
          </div>

          <Badge
            variant="outline"
            className={getCriticalityBadgeClass(
              "SIN DATOS",
            )}
          >
            SIN DATOS
          </Badge>
        </div>
      </div>
    );
  }

  const displayStatus =
    criticality.status_display ||
    criticality.status_label;

  const hasTotal =
    criticality.total_criticality !==
    null;

  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />

            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Criticidad
            </p>
          </div>

          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {hasTotal
              ? `${criticality.total_criticality} puntos`
              : "No calculada"}
          </p>
        </div>

        <Badge
          variant="outline"
          className={[
            getCriticalityBadgeClass(
              displayStatus,
            ),
            "shrink-0 font-bold",
          ].join(" ")}
        >
          {displayStatus}
        </Badge>
      </div>

      {criticality.has_checklist && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {criticality.work_orders_count} OT en los últimos 6 meses
        </p>
      )}
    </div>
  );
}

function VehicleOperationalDetail({
  detail,
}: {
  detail: VehicleCardDetail;
}) {
  const toneClasses = {
    repair:
      "border-yellow-200 bg-yellow-50/70 text-yellow-950 dark:border-yellow-900 dark:bg-yellow-950/20 dark:text-yellow-100",
    warning:
      "border-orange-200 bg-orange-50/70 text-orange-950 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-100",
    danger:
      "border-red-200 bg-red-50/70 text-red-950 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100",
    info:
      "border-blue-200 bg-blue-50/60 text-blue-950 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100",
  };

  const icon =
    detail.tone === "repair" ||
    detail.tone === "warning"
      ? (
          <Wrench className="h-4 w-4 shrink-0" />
        )
      : detail.tone === "danger"
        ? (
            <Info className="h-4 w-4 shrink-0" />
          )
        : (
            <FileText className="h-4 w-4 shrink-0" />
          );

  return (
    <div
      className={[
        "rounded-lg border p-2.5",
        toneClasses[detail.tone],
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {icon}

        <p className="text-[10px] font-bold uppercase tracking-[0.11em]">
          {detail.label}
        </p>
      </div>

      <p
        className="mt-1.5 line-clamp-3 text-[13px] leading-5"
        title={detail.value}
      >
        {detail.value}
      </p>
    </div>
  );
}

function VehicleInfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">
        {label}
      </span>

      <span className="text-right text-[13px] font-medium leading-snug">
        {value?.trim() || "-"}
      </span>
    </div>
  );
}




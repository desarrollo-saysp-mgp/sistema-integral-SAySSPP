"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ComplaintsTable } from "@/components/tables/ComplaintsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Filter } from "lucide-react";
import type { Complaint, Service, User } from "@/types";
import { toast } from "sonner";
import { useComplaintsRealtime } from "@/hooks/useComplaintsRealtime";
import { useUser } from "@/hooks/useUser";

const VALID_STATUSES = ["En proceso", "Resuelto", "No resuelto"] as const;
const ZONE_OPTIONS = Array.from({ length: 16 }, (_, i) => String(i + 1));

const SERVICIOS_PUBLICOS_EMAIL = "adm.serviciospublicos.mgp@gmail.com";
const GIRSU_EMAIL = "direccióngirsupico@gmail.com";

const SERVICIOS_PUBLICOS_KEYWORDS = [
  "barrido",
  "riego",
  "motonivelacion",
  "canales y desagues",
];

const GIRSU_KEYWORDS = [
  "rec. domiciliaria",
  "rec domiciliaria",
  "rec. especial",
  "rec especial",
  "inspeccion",
  "rec. contenedores",
  "rec contenedores",
];


type ComplaintWithDetails = Complaint & {
  service: Service | null;
  cause: any | null;
  loaded_by_user: User;
};

type ComplaintExtraData = {
  // Formato que usaba el código
  department?: unknown;
  description_type?: unknown;
  level?: unknown;

  // Formato real que vino desde la importación de Arbolado
  depto?: unknown;
  descripcion?: unknown;
  nivel?: unknown;
};

type VariantFilter = "general" | "arbolado" | "zyv";

const getExtraData = (complaint: Complaint): ComplaintExtraData => {
  if (
    complaint.extra_data &&
    typeof complaint.extra_data === "object" &&
    !Array.isArray(complaint.extra_data)
  ) {
    return complaint.extra_data as ComplaintExtraData;
  }

  return {};
};

const getArboladoDepartment = (extra: ComplaintExtraData) => {
  if (typeof extra.department === "string") return extra.department;
  if (typeof extra.depto === "string") return extra.depto;
  return "";
};

const getArboladoLevel = (extra: ComplaintExtraData) => {
  if (typeof extra.level === "string") return extra.level;
  if (typeof extra.nivel === "string") return extra.nivel;
  return "";
};

const getArboladoDescription = (extra: ComplaintExtraData) => {
  if (typeof extra.description_type === "string") {
    return extra.description_type;
  }

  if (typeof extra.descripcion === "string") {
    return extra.descripcion;
  }

  return "";
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeAddressText = (value: unknown) =>
  normalizeText(value).replace(/\s+/g, " ");

const getStreetQuery = (value: string) => {
  const query = normalizeAddressText(value);

  if (!query) return "";

  if (/^\d+$/.test(query)) return `calle ${query}`;

  return query;
};

const matchesStreetAddress = (address: unknown, filter: string) => {
  const query = getStreetQuery(filter);

  if (!query) return true;

  const normalizedAddress = normalizeAddressText(address);

  if (!normalizedAddress.startsWith(query)) return false;

  const nextCharacter = normalizedAddress.charAt(query.length);

  return (
    !nextCharacter ||
    nextCharacter === " " ||
    nextCharacter === "," ||
    nextCharacter === "." ||
    nextCharacter === "-" ||
    nextCharacter === "/"
  );
};

const isArboladoComplaint = (complaint: ComplaintWithDetails) => {
  const serviceName = normalizeText(complaint.service?.name);

  return (
    complaint.form_variant === "arbolado" ||
    serviceName.includes("arbolado")
  );
};

const isZyvComplaint = (complaint: ComplaintWithDetails) => {
  const serviceName = normalizeText(complaint.service?.name);

  return (
    complaint.form_variant === "zyv" ||
    serviceName.includes("zoonosis") ||
    serviceName.includes("vectores")
  );
};

const isServiciosPublicosServiceName = (serviceName: unknown) => {
  const normalizedServiceName = normalizeText(serviceName);

  return SERVICIOS_PUBLICOS_KEYWORDS.some((keyword) =>
    normalizedServiceName.includes(keyword)
  );
};

const isServiciosPublicosComplaint = (complaint: ComplaintWithDetails) =>
  isServiciosPublicosServiceName(complaint.service?.name);

const isGirsuServiceName = (serviceName: unknown) => {
  const normalizedServiceName = normalizeText(serviceName);

  return GIRSU_KEYWORDS.some((keyword) =>
    normalizedServiceName.includes(keyword)
  );
};

const isGirsuComplaint = (complaint: ComplaintWithDetails) =>
  isGirsuServiceName(complaint.service?.name);

const isGeneralComplaint = (complaint: ComplaintWithDetails) =>
  complaint.form_variant === "general" ||
  complaint.form_variant === "import_excel" ||
  complaint.form_variant == null;

const normalizeComplaintForTable = (
  complaint: ComplaintWithDetails
): ComplaintWithDetails => {
  const isArbolado = isArboladoComplaint(complaint);

  const displayNumber =
    isArbolado && complaint.arbolado_number != null
      ? String(complaint.arbolado_number)
      : complaint.complaint_number != null
        ? String(complaint.complaint_number)
        : null;

  return {
    ...complaint,
    complaint_number: displayNumber,
  };
};

export default function ComplaintsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const latestRequestRef = useRef(0);

  const { profile } = useUser();

  const isArboladoUser = profile?.role === "ReclamosArbolado";
  const isZyvUser = profile?.role === "ReclamosZyV";
  const isAdminUser =
    profile?.role === "Admin" || profile?.role === "AdminLectura";
  const isServiciosPublicosUser =
    normalizeText(profile?.email) === SERVICIOS_PUBLICOS_EMAIL;

  const isGirsuUser = normalizeText(profile?.email) === normalizeText(GIRSU_EMAIL);

  const canCreateComplaints = !isServiciosPublicosUser && !isGirsuUser;

  const getParam = useCallback(
    (key: string, fallback = "") => searchParams.get(key) || fallback,
    [searchParams]
  );

  const getValidStatusFromUrl = useCallback(() => {
    const status = searchParams.get("status");

    if (
      status &&
      VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])
    ) {
      return status;
    }

    return "all";
  }, [searchParams]);

  const getValidVariantFromUrl = useCallback((): VariantFilter => {
    const variant = searchParams.get("tipo");

    if (variant === "arbolado" || variant === "zyv" || variant === "general") {
      return variant;
    }

    return "general";
  }, [searchParams]);

  const [variantFilter, setVariantFilter] =
    useState<VariantFilter>(getValidVariantFromUrl);

  const previousVariantRef = useRef<VariantFilter>(variantFilter);

  const isArboladoView =
    isArboladoUser || (isAdminUser && variantFilter === "arbolado");

  const isZyvView = isZyvUser || (isAdminUser && variantFilter === "zyv");

  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState(() => getParam("buscar"));
  const [addressFilter, setAddressFilter] = useState(() => getParam("calle"));
  const [streetNumberFilter, setStreetNumberFilter] = useState(() =>
    getParam("numero")
  );
  const [statusFilter, setStatusFilter] = useState(getValidStatusFromUrl);
  const [serviceFilter, setServiceFilter] = useState(() =>
    getParam("servicio", "all")
  );
  const [zoneFilter, setZoneFilter] = useState(() => getParam("zona", "all"));
  const [dateFromFilter, setDateFromFilter] = useState(() =>
    getParam("desde")
  );
  const [dateToFilter, setDateToFilter] = useState(() => getParam("hasta"));

  const [departmentFilter, setDepartmentFilter] = useState(() =>
    getParam("depto", "all")
  );
  const [levelFilter, setLevelFilter] = useState(() =>
    getParam("nivel", "all")
  );
  const [descriptionFilter, setDescriptionFilter] = useState(() =>
    getParam("descripcion", "all")
  );

  const updateUrlFilters = useCallback(() => {
    const params = new URLSearchParams();

    if (isAdminUser && variantFilter !== "general") {
      params.set("tipo", variantFilter);
    }

    if (searchTerm.trim()) {
      params.set("buscar", searchTerm.trim());
    }

    if (addressFilter.trim()) {
      params.set("calle", addressFilter.trim());
    }

    if (streetNumberFilter.trim()) {
      params.set("numero", streetNumberFilter.trim());
    }

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    if (!isArboladoView && serviceFilter !== "all") {
      params.set("servicio", serviceFilter);
    }

    if (!isArboladoView && zoneFilter !== "all") {
      params.set("zona", zoneFilter);
    }

    if (dateFromFilter) {
      params.set("desde", dateFromFilter);
    }

    if (dateToFilter) {
      params.set("hasta", dateToFilter);
    }

    if (isArboladoView && departmentFilter !== "all") {
      params.set("depto", departmentFilter);
    }

    if (isArboladoView && levelFilter !== "all") {
      params.set("nivel", levelFilter);
    }

    if (isArboladoView && descriptionFilter !== "all") {
      params.set("descripcion", descriptionFilter);
    }

    const queryString = params.toString();

    const nextUrl = queryString
      ? `/dashboard/complaints?${queryString}`
      : "/dashboard/complaints";

    router.replace(nextUrl, { scroll: false });
  }, [
    router,
    isAdminUser,
    variantFilter,
    searchTerm,
    addressFilter,
    streetNumberFilter,
    statusFilter,
    isArboladoView,
    serviceFilter,
    zoneFilter,
    dateFromFilter,
    dateToFilter,
    departmentFilter,
    levelFilter,
    descriptionFilter,
  ]);

  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch("/api/services", {
        cache: "no-store",
      });

      const data = await response.json();

      if (data.data) {
        let activeServices = data.data.filter((s: Service) => s.active);

        if (isZyvView) {
          activeServices = activeServices.filter((service: Service) => {
            const name = normalizeText(service.name);

            return name.includes("zoonosis") || name.includes("vectores");
          });
        }

        if (isArboladoView) {
          activeServices = activeServices.filter((service: Service) =>
            normalizeText(service.name).includes("arbolado")
          );
        }

        if (isServiciosPublicosUser) {
          activeServices = activeServices.filter((service: Service) =>
            isServiciosPublicosServiceName(service.name)
          );
        }

        if (isGirsuUser) {
          activeServices = activeServices.filter((service: Service) =>
            isGirsuServiceName(service.name)
          );
        }

        setServices(activeServices);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  }, [isZyvView, isArboladoView, isServiciosPublicosUser, isGirsuUser]);

  const fetchComplaints = useCallback(
    async (showLoader = true) => {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      if (showLoader) {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();

        if (statusFilter && statusFilter !== "all") {
          params.append("status", statusFilter);
        }

        if (!isArboladoView && serviceFilter !== "all") {
          params.append("service_id", serviceFilter);
        }

        if (!isArboladoView && zoneFilter !== "all") {
          params.append("zone", zoneFilter);
        }

        if (dateFromFilter) {
          params.append("date_from", dateFromFilter);
        }

        if (dateToFilter) {
          params.append("date_to", dateToFilter);
        }

        /*
          IMPORTANTE:
          En Admin, cuando seleccionamos "Reclamos Arbolado" o "Reclamos ZyV",
          NO mandamos form_variant al backend.

          Motivo:
          - Hay reclamos con servicio "Arbolado" que tienen form_variant="general".
          - Hay reclamos con servicio "Zoonosis" o "Vectores" que pueden tener form_variant="general".

          Si mandamos form_variant=arbolado o form_variant=zyv,
          el backend devuelve menos reclamos.

          Si no lo mandamos, traemos todos y filtramos en frontend con:
          - isArboladoComplaint
          - isZyvComplaint
        */
        if (
          isAdminUser &&
          variantFilter !== "arbolado" &&
          variantFilter !== "zyv"
        ) {
          params.append("form_variant", variantFilter);
        }

        const response = await fetch(`/api/complaints?${params.toString()}`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (requestId !== latestRequestRef.current) return;

        if (response.ok && data.data) {
          const normalizedComplaints: ComplaintWithDetails[] = data.data.map(
            (complaint: ComplaintWithDetails) =>
              normalizeComplaintForTable(complaint)
          );

          setComplaints(normalizedComplaints);
        } else {
          toast.error(data.error || "Error al cargar reclamos");
        }
      } catch (error) {
        if (requestId !== latestRequestRef.current) return;

        console.error("Error fetching complaints:", error);
        toast.error("Error al cargar reclamos");
      } finally {
        if (showLoader && requestId === latestRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [
      statusFilter,
      serviceFilter,
      zoneFilter,
      dateFromFilter,
      dateToFilter,
      isArboladoView,
      isAdminUser,
      variantFilter,
    ]
  );

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    updateUrlFilters();
  }, [updateUrlFilters]);

  useEffect(() => {
    if (previousVariantRef.current === variantFilter) {
      return;
    }

    previousVariantRef.current = variantFilter;

    setServiceFilter("all");
    setZoneFilter("all");
    setDepartmentFilter("all");
    setLevelFilter("all");
    setDescriptionFilter("all");
  }, [variantFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  useComplaintsRealtime({
    onChange: () => {
      void fetchComplaints(false);
    },
  });

  const filteredComplaints = useMemo(() => {
    let sourceComplaints = complaints;

    if (isArboladoView) {
      sourceComplaints = complaints.filter(isArboladoComplaint);
    }

    if (isZyvView) {
      sourceComplaints = complaints.filter(isZyvComplaint);
    }

    if (isServiciosPublicosUser) {
      sourceComplaints = complaints.filter(isServiciosPublicosComplaint);
    }

    if (isGirsuUser) {
      sourceComplaints = complaints.filter(isGirsuComplaint);
    }

    if (
      !isServiciosPublicosUser &&
      !isGirsuUser &&
      !isArboladoView &&
      !isZyvView &&
      isAdminUser &&
      variantFilter === "general"
    ) {
      sourceComplaints = complaints.filter(isGeneralComplaint);
    }

    return sourceComplaints.filter((complaint) => {
      const extra = getExtraData(complaint);
      const arboladoDescriptionValue = getArboladoDescription(extra);
      const departmentValue = getArboladoDepartment(extra);
      const levelValue = getArboladoLevel(extra);

      const query = searchTerm.toLowerCase().trim();
      const streetNumberQuery = streetNumberFilter.toLowerCase().trim();

      const matchesSearch =
        !query ||
        (complaint.complainant_name || "").toLowerCase().includes(query) ||
        (isArboladoView &&
          arboladoDescriptionValue.toLowerCase().includes(query)) ||
        (isArboladoView &&
          (complaint.details || "").toLowerCase().includes(query));

      const matchesAddress = matchesStreetAddress(
        complaint.address,
        addressFilter
      );

      const matchesStreetNumber =
        !streetNumberQuery ||
        (complaint.street_number || "")
          .toLowerCase()
          .includes(streetNumberQuery);

      const matchesDepartment =
        !isArboladoView ||
        departmentFilter === "all" ||
        departmentValue === departmentFilter;

      const matchesLevel =
        !isArboladoView || levelFilter === "all" || levelValue === levelFilter;

      const matchesDescription =
        !isArboladoView ||
        descriptionFilter === "all" ||
        arboladoDescriptionValue === descriptionFilter;

      return (
        matchesSearch &&
        matchesAddress &&
        matchesStreetNumber &&
        matchesDepartment &&
        matchesLevel &&
        matchesDescription
      );
    });
  }, [
    complaints,
    isArboladoView,
    isZyvView,
    isServiciosPublicosUser,
    isGirsuUser,
    isAdminUser,
    variantFilter,
    searchTerm,
    addressFilter,
    streetNumberFilter,
    departmentFilter,
    levelFilter,
    descriptionFilter,
  ]);

  const arboladoDepartments = useMemo(() => {
    const values = complaints
      .filter(isArboladoComplaint)
      .map((complaint) => getArboladoDepartment(getExtraData(complaint)))
      .filter((value): value is string => !!value);

    return [...new Set(values)].sort();
  }, [complaints]);

  const arboladoLevels = useMemo(() => {
    const values = complaints
      .filter(isArboladoComplaint)
      .map((complaint) => getArboladoLevel(getExtraData(complaint)))
      .filter((value): value is string => !!value);

    return [...new Set(values)].sort();
  }, [complaints]);

  const arboladoDescriptions = useMemo(() => {
    const values = complaints
      .filter(isArboladoComplaint)
      .map((complaint) => getArboladoDescription(getExtraData(complaint)))
      .filter((value): value is string => !!value);

    return [...new Set(values)].sort();
  }, [complaints]);

  const handleStatusChange = async (
    complaintId: number,
    newStatus: string
  ) => {
    try {
      const response = await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al actualizar");
      }

      await fetchComplaints(false);
    } catch (error) {
      throw error;
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setAddressFilter("");
    setStreetNumberFilter("");
    setStatusFilter("all");
    setServiceFilter("all");
    setZoneFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setDepartmentFilter("all");
    setLevelFilter("all");
    setDescriptionFilter("all");

    if (isAdminUser) {
      setVariantFilter("general");
    }

    router.replace("/dashboard/complaints", { scroll: false });
  };

  const hasActiveFilters = isArboladoView
    ? !!(
        searchTerm ||
        addressFilter ||
        streetNumberFilter ||
        statusFilter !== "all" ||
        dateFromFilter ||
        dateToFilter ||
        departmentFilter !== "all" ||
        levelFilter !== "all" ||
        descriptionFilter !== "all"
      )
    : !!(
        searchTerm ||
        addressFilter ||
        streetNumberFilter ||
        statusFilter !== "all" ||
        serviceFilter !== "all" ||
        zoneFilter !== "all" ||
        dateFromFilter ||
        dateToFilter
      );

  return (
    <>
      <PageLoader show={loading} />

      <div className="container mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reclamos</h1>
            <p className="mt-2 text-muted-foreground">
              Gestión y seguimiento de reclamos ciudadanos
            </p>
          </div>

          {canCreateComplaints && (
            <Button
              onClick={() => router.push("/dashboard/complaints/new")}
              className="h-12 rounded-xl bg-[#00A27F] px-6 font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-[#008568] hover:shadow-lg active:scale-[0.98]"
            >
              <Plus className="mr-2 h-5 w-5" />
              Nuevo Reclamo
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="space-y-4 pb-5 pt-5">
            <div className="flex items-center gap-2 border-b pb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Filtros
              </h2>
            </div>

            <div className="flex flex-wrap items-end gap-3 xl:flex-nowrap">
              {isAdminUser && (
                <div className="flex w-full flex-col gap-1.5 sm:w-[170px] xl:w-[160px]">
                  <Label htmlFor="variant-filter">Tipo</Label>
                  <Select
                    value={variantFilter}
                    onValueChange={(value) =>
                      setVariantFilter(value as VariantFilter)
                    }
                  >
                    <SelectTrigger id="variant-filter" className="h-10 w-full">
                      <SelectValue placeholder="Reclamos" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="general">Reclamos</SelectItem>
                      <SelectItem value="arbolado">
                        Reclamos Arbolado
                      </SelectItem>
                      <SelectItem value="zyv">Reclamos ZyV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex w-full flex-col gap-1.5 sm:w-[320px] xl:w-[300px]">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <Input
                    id="search"
                    placeholder={
                      isArboladoView
                        ? "Buscar por nombre o descripción..."
                        : "Buscar por nombre..."
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 pl-10"
                  />
                </div>
              </div>

              <div className="flex w-full flex-col gap-1.5 sm:w-[190px] xl:w-[165px]">
                <Label htmlFor="address-filter">Calle</Label>
                <Input
                  id="address-filter"
                  placeholder="Buscar por calle..."
                  value={addressFilter}
                  onChange={(e) => setAddressFilter(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="flex w-full flex-col gap-1.5 sm:w-[100px] xl:w-[80px]">
                <Label htmlFor="street-number-filter">Número</Label>
                <Input
                  id="street-number-filter"
                  placeholder="Nro."
                  value={streetNumberFilter}
                  onChange={(e) => setStreetNumberFilter(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="flex w-full flex-col gap-1.5 sm:w-[160px] xl:w-[125px]">
                <Label htmlFor="status-filter">Estado</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter" className="h-10 w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="En proceso">En proceso</SelectItem>
                    <SelectItem value="Resuelto">Resuelto</SelectItem>
                    <SelectItem value="No resuelto">No resuelto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!isArboladoView && (
                <>
                  <div className="flex w-full flex-col gap-1.5 sm:w-[170px] xl:w-[145px]">
                    <Label htmlFor="service-filter">Servicio</Label>
                    <Select
                      value={serviceFilter}
                      onValueChange={setServiceFilter}
                    >
                      <SelectTrigger id="service-filter" className="h-10 w-full">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {services.map((service) => (
                          <SelectItem
                            key={service.id}
                            value={service.id.toString()}
                          >
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex w-full flex-col gap-1.5 sm:w-[150px] xl:w-[115px]">
                    <Label htmlFor="zone-filter">Zona</Label>
                    <Select value={zoneFilter} onValueChange={setZoneFilter}>
                      <SelectTrigger id="zone-filter" className="h-10 w-full">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {ZONE_OPTIONS.map((zone) => (
                          <SelectItem key={zone} value={zone}>
                            Zona {zone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {isArboladoView && (
                <>
                  <div className="flex w-full flex-col gap-1.5 sm:w-[160px] xl:w-[135px]">
                    <Label htmlFor="department-filter">Depto</Label>
                    <Select
                      value={departmentFilter}
                      onValueChange={setDepartmentFilter}
                    >
                      <SelectTrigger
                        id="department-filter"
                        className="h-10 w-full"
                      >
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {arboladoDepartments.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex w-full flex-col gap-1.5 sm:w-[140px] xl:w-[120px]">
                    <Label htmlFor="level-filter">Nivel</Label>
                    <Select value={levelFilter} onValueChange={setLevelFilter}>
                      <SelectTrigger id="level-filter" className="h-10 w-full">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {arboladoLevels.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex w-full flex-col gap-1.5 sm:w-[220px] xl:w-[190px]">
                    <Label htmlFor="description-filter">Descripción</Label>
                    <Select
                      value={descriptionFilter}
                      onValueChange={setDescriptionFilter}
                    >
                      <SelectTrigger
                        id="description-filter"
                        className="h-10 w-full"
                      >
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {arboladoDescriptions.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex w-full flex-col gap-1.5 sm:w-[150px] xl:w-[130px]">
                <Label htmlFor="date-from">Desde</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="flex w-full flex-col gap-1.5 sm:w-[150px] xl:w-[130px]">
                <Label htmlFor="date-to">Hasta</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="rounded-xl"
                >
                  Limpiar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {!loading && (
          <div className="text-sm text-muted-foreground">
            {filteredComplaints.length} reclamo
            {filteredComplaints.length !== 1 ? "s" : ""} encontrado
            {filteredComplaints.length !== 1 ? "s" : ""}
          </div>
        )}

        <ComplaintsTable
          complaints={filteredComplaints}
          onStatusChange={handleStatusChange}
        />
      </div>
    </>
  );
}
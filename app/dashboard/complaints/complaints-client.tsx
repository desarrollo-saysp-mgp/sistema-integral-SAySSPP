"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { Complaint, Service, Cause, User } from "@/types";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";

const VALID_STATUSES = ["En proceso", "Resuelto", "No resuelto"] as const;
const ZONE_OPTIONS = Array.from({ length: 16 }, (_, i) => String(i + 1));

type ComplaintWithDetails = Complaint & {
  service: Service | null;
  cause: Cause | null;
  loaded_by_user: User;
};

type ComplaintExtraData = {
  department?: unknown;
  description_type?: unknown;
  level?: unknown;
};

type VariantFilter = "general" | "arbolado";

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

const normalizeAddressText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const getStreetQuery = (value: string) => {
  const query = normalizeAddressText(value);

  if (!query) return "";

  // Si el usuario escribe solo "33", lo interpretamos como "Calle 33"
  if (/^\d+$/.test(query)) {
    return `calle ${query}`;
  }

  return query;
};

const matchesStreetAddress = (address: unknown, filter: string) => {
  const query = getStreetQuery(filter);

  if (!query) return true;

  const normalizedAddress = normalizeAddressText(address);

  if (!normalizedAddress.startsWith(query)) {
    return false;
  }

  const nextCharacter = normalizedAddress.charAt(query.length);

  // Permite "Calle 33", "Calle 33 1065", "Calle 33 bis"
  // Bloquea "Calle 331", "Calle 332", etc.
  return (
    !nextCharacter ||
    nextCharacter === " " ||
    nextCharacter === "," ||
    nextCharacter === "." ||
    nextCharacter === "-" ||
    nextCharacter === "/"
  );
};

export default function ComplaintsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const latestRequestRef = useRef(0);
  const { profile } = useUser();

  const isArboladoUser = profile?.role === "ReclamosArbolado";
  const isAdminUser =
    profile?.role === "Admin" || profile?.role === "AdminLectura";

  const [variantFilter, setVariantFilter] =
    useState<VariantFilter>("general");

  const isArboladoView =
    isArboladoUser || (isAdminUser && variantFilter === "arbolado");

  const statusFromUrl = searchParams.get("status");
  const initialStatus =
    statusFromUrl &&
      VALID_STATUSES.includes(
        statusFromUrl as (typeof VALID_STATUSES)[number],
      )
      ? statusFromUrl
      : "all";

  const [complaints, setComplaints] = useState<ComplaintWithDetails[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [addressFilter, setAddressFilter] = useState("");
  const [streetNumberFilter, setStreetNumberFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [descriptionFilter, setDescriptionFilter] = useState("all");

  useEffect(() => {
    fetchServices();
  }, [profile?.role]);

  useEffect(() => {
    const nextStatus =
      statusFromUrl &&
        VALID_STATUSES.includes(
          statusFromUrl as (typeof VALID_STATUSES)[number],
        )
        ? statusFromUrl
        : "all";

    setStatusFilter((prev) => (prev !== nextStatus ? nextStatus : prev));
  }, [statusFromUrl]);

  useEffect(() => {
    setServiceFilter("all");
    setZoneFilter("all");
    setDepartmentFilter("all");
    setLevelFilter("all");
    setDescriptionFilter("all");
  }, [variantFilter]);

  useEffect(() => {
    fetchComplaints();
  }, [
    statusFilter,
    serviceFilter,
    zoneFilter,
    dateFromFilter,
    dateToFilter,
    isArboladoUser,
    variantFilter,
  ]);

  const fetchServices = async () => {
    try {
      const response = await fetch("/api/services");
      const data = await response.json();

      if (data.data) {
        let activeServices = data.data.filter((s: Service) => s.active);

        // 👉 SOLO Zoonosis y Vectores
        if (profile?.role === "ReclamosZyV") {
          activeServices = activeServices.filter((service: Service) => {
            const name = service.name
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");

            return (
              name.includes("zoonosis") ||
              name.includes("vectores")
            );
          });
        }

        // 👉 SOLO Arbolado
        if (profile?.role === "ReclamosArbolado") {
          activeServices = activeServices.filter((service: Service) => {
            const name = service.name
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");

            return name.includes("arbolado");
          });
        }

        setServices(activeServices);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchComplaints = async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);

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

      if (dateFromFilter) params.append("date_from", dateFromFilter);
      if (dateToFilter) params.append("date_to", dateToFilter);

      if (isArboladoUser) {
        params.append("form_variant", "arbolado");
      } else if (isAdminUser) {
        params.append("form_variant", variantFilter);
      } else {
        params.append("form_variant", "general");
      }

      const response = await fetch(`/api/complaints?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (requestId !== latestRequestRef.current) {
        return;
      }

      if (response.ok && data.data) {
        setComplaints(data.data);
      } else {
        toast.error(data.error || "Error al cargar reclamos");
      }
    } catch (error) {
      if (requestId !== latestRequestRef.current) {
        return;
      }

      console.error("Error fetching complaints:", error);
      toast.error("Error al cargar reclamos");
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const filteredComplaints = useMemo(() => {
    let sourceComplaints = complaints;

    if (isArboladoView) {
      sourceComplaints = complaints.filter(
        (complaint) => complaint.form_variant === "arbolado",
      );
    }

    if (!isArboladoView) {
      sourceComplaints = complaints.filter(
        (complaint) =>
          complaint.form_variant === "general" ||
          complaint.form_variant === "import_excel" ||
          complaint.form_variant == null,
      );
    }

    return sourceComplaints.filter((complaint) => {
      const extra = getExtraData(complaint);
      const query = searchTerm.toLowerCase().trim();
      const addressQuery = addressFilter.toLowerCase().trim();
      const streetNumberQuery = streetNumberFilter.toLowerCase().trim();

      const matchesSearch =
        !query ||
        (complaint.complainant_name || "").toLowerCase().includes(query) ||
        (isArboladoView &&
          typeof extra.description_type === "string" &&
          extra.description_type.toLowerCase().includes(query)) ||
        (isArboladoView &&
          (complaint.details || "").toLowerCase().includes(query));

      const matchesAddress = matchesStreetAddress(
        complaint.address,
        addressFilter,
      );

      const matchesStreetNumber =
        !streetNumberQuery ||
        (complaint.street_number || "")
          .toLowerCase()
          .includes(streetNumberQuery);

      const matchesDepartment =
        !isArboladoView ||
        departmentFilter === "all" ||
        (typeof extra.department === "string" &&
          extra.department === departmentFilter);

      const matchesLevel =
        !isArboladoView ||
        levelFilter === "all" ||
        (typeof extra.level === "string" && extra.level === levelFilter);

      const matchesDescription =
        !isArboladoView ||
        descriptionFilter === "all" ||
        (typeof extra.description_type === "string" &&
          extra.description_type === descriptionFilter);

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
    searchTerm,
    addressFilter,
    streetNumberFilter,
    departmentFilter,
    levelFilter,
    descriptionFilter,
  ]);

  const arboladoDepartments = useMemo(() => {
    const values = complaints
      .filter((complaint) => complaint.form_variant === "arbolado")
      .map((complaint) => getExtraData(complaint).department)
      .filter((value): value is string => typeof value === "string" && !!value);

    return [...new Set(values)].sort();
  }, [complaints]);

  const arboladoLevels = useMemo(() => {
    const values = complaints
      .filter((complaint) => complaint.form_variant === "arbolado")
      .map((complaint) => getExtraData(complaint).level)
      .filter((value): value is string => typeof value === "string" && !!value);

    return [...new Set(values)].sort();
  }, [complaints]);

  const arboladoDescriptions = useMemo(() => {
    const values = complaints
      .filter((complaint) => complaint.form_variant === "arbolado")
      .map((complaint) => getExtraData(complaint).description_type)
      .filter((value): value is string => typeof value === "string" && !!value);

    return [...new Set(values)].sort();
  }, [complaints]);

  const handleStatusChange = async (
    complaintId: number,
    newStatus: string,
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

      await fetchComplaints();
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
    router.push("/dashboard/complaints");
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
          <Button
            onClick={() => router.push("/dashboard/complaints/new")}
            className="h-12 rounded-xl bg-[#00A27F] px-6 font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-[#008568] hover:shadow-lg active:scale-[0.98]"
          >
            <Plus className="mr-2 h-5 w-5" />
            Nuevo Reclamo
          </Button>
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
                <div className="flex w-full flex-col gap-1.5 sm:w-[150px] xl:w-[135px]">
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
                      <SelectItem value="arbolado">Reclamos Arbolado</SelectItem>
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
                    <Select value={serviceFilter} onValueChange={setServiceFilter}>
                      <SelectTrigger id="service-filter" className="h-10 w-full">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id.toString()}>
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
                      <SelectTrigger id="department-filter" className="h-10 w-full">
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
                      <SelectTrigger id="description-filter" className="h-10 w-full">
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
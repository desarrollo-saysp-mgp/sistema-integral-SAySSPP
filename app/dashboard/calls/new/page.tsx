"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  PhoneForwarded,
  Save,
  User,
  Building2,
  ClipboardList,
  CalendarDays,
  Search,
  FilterX,
  PhoneCall,
  FileDown,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/useUser";

type CallRecord = {
  id: number;
  caller_name: string | null;
  reason: string;
  destination_area: string | null;
  action_taken: string | null;
  call_datetime: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
};

type EditCallForm = {
  id: number;
  callerName: string;
  reason: string;
  destinationArea: string;
  actionTaken: string;
  callDateTime: string;
};

const ACTION_OPTIONS = [
  "Se brindó número telefónico",
  "Se derivó la llamada",
  "Se brindó información",
  "No se pudo derivar",
  "Otro",
];

const CALLS_PER_PAGE = 6;

const getLocalDateTimeValue = () => {
  const now = new Date();

  const offset = now.getTimezoneOffset();

  const localDate = new Date(
    now.getTime() - offset * 60 * 1000,
  );

  return localDate.toISOString().slice(0, 16);
};

const toLocalDateTimeValue = (
  value: string | null,
) => {
  if (!value) {
    return getLocalDateTimeValue();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getLocalDateTimeValue();
  }

  const offset = date.getTimezoneOffset();

  const localDate = new Date(
    date.getTime() - offset * 60 * 1000,
  );

  return localDate.toISOString().slice(0, 16);
};

const formatDateTime = (
  value: string | null,
) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function NewCallPage() {
  const router = useRouter();

  const { profile } = useUser();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  /*
   * FORMULARIO NUEVA LLAMADA
   */
  const [callerName, setCallerName] =
    useState("");

  const [reason, setReason] =
    useState("");

  const [
    destinationArea,
    setDestinationArea,
  ] = useState("");

  const [
    actionTaken,
    setActionTaken,
  ] = useState("");

  const [
    callDateTime,
    setCallDateTime,
  ] = useState(
    getLocalDateTimeValue(),
  );

  const [saving, setSaving] =
    useState(false);

  /*
   * REGISTROS
   */
  const [calls, setCalls] =
    useState<CallRecord[]>([]);

  const [
    loadingCalls,
    setLoadingCalls,
  ] = useState(true);

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    sortOrder,
    setSortOrder,
  ] = useState<"desc" | "asc">("desc");

  /*
   * FILTROS
   */
  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    dateFrom,
    setDateFrom,
  ] = useState("");

  const [
    dateTo,
    setDateTo,
  ] = useState("");

  const [
    areaFilter,
    setAreaFilter,
  ] = useState("");

  const [
    actionFilter,
    setActionFilter,
  ] = useState("");

  /*
   * EDICIÓN
   */
  const [
    editingCall,
    setEditingCall,
  ] = useState<EditCallForm | null>(
    null,
  );

  const [
    savingEdit,
    setSavingEdit,
  ] = useState(false);

  const [
    deletingCallId,
    setDeletingCallId,
  ] = useState<number | null>(null);

  const [
    callToDelete,
    setCallToDelete,
  ] = useState<CallRecord | null>(null);

  /*
   * TRAER LLAMADAS
   */
  const fetchCalls =
    useCallback(async () => {
      try {
        setLoadingCalls(true);

        const { data, error } =
          await supabase
            .from("call_records")
            .select(`
              id,
              caller_name,
              reason,
              destination_area,
              action_taken,
              call_datetime,
              created_at,
              created_by,
              created_by_name
            `)
            .order("created_at", {
              ascending: false,
            });

        if (error) {
          console.error(
            "Error cargando llamadas:",
            error,
          );

          toast.error(
            "No se pudieron cargar las llamadas registradas.",
          );

          return;
        }

        const records =
          (data || []) as CallRecord[];

        records.sort((a, b) => {
          const dateA =
            new Date(
              a.call_datetime ||
                a.created_at,
            ).getTime();

          const dateB =
            new Date(
              b.call_datetime ||
                b.created_at,
            ).getTime();

          return dateB - dateA;
        });

        setCalls(records);
      } catch (error) {
        console.error(
          "Error cargando llamadas:",
          error,
        );

        toast.error(
          "Ocurrió un error al cargar las llamadas.",
        );
      } finally {
        setLoadingCalls(false);
      }
    }, [supabase]);

  useEffect(() => {
    void fetchCalls();
  }, [fetchCalls]);

  /*
   * REGISTRAR LLAMADA
   */
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const cleanReason =
      reason.trim();

    if (!cleanReason) {
      toast.error(
        "Ingresá el motivo de la llamada.",
      );

      return;
    }

    if (!callDateTime) {
      toast.error(
        "Ingresá la fecha y hora de la llamada.",
      );

      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "Error obteniendo usuario:",
          userError,
        );

        toast.error(
          "No se pudo identificar al usuario.",
        );

        return;
      }

      const callDate =
        new Date(callDateTime);

      const { error } =
        await supabase
          .from("call_records")
          .insert({
            caller_name:
              callerName.trim() ||
              null,

            reason:
              cleanReason,

            destination_area:
              destinationArea.trim() ||
              null,

            action_taken:
              actionTaken || null,

            call_datetime:
              callDate.toISOString(),

            created_by:
              user.id,

            created_by_name:
              profile?.full_name ||
              "Usuario",
          });

      if (error) {
        console.error(
          "Error registrando llamada:",
          error,
        );

        toast.error(
          "No se pudo registrar la llamada.",
        );

        return;
      }

      toast.success(
        "Consulta derivada registrada correctamente.",
      );

      setCallerName("");
      setReason("");
      setDestinationArea("");
      setActionTaken("");

      setCallDateTime(
        getLocalDateTimeValue(),
      );

      await fetchCalls();
    } catch (error) {
      console.error(
        "Error inesperado:",
        error,
      );

      toast.error(
        "Ocurrió un error al registrar la llamada.",
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * FILTROS
   */
  const filteredCalls =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      const normalizedArea =
        areaFilter
          .trim()
          .toLowerCase();

      const filtered = calls.filter(
        (call) => {
          const callDateValue =
            call.call_datetime ||
            call.created_at;

          const callDate =
            new Date(
              callDateValue,
            );

          const matchesSearch =
            !normalizedSearch ||
            call.caller_name
              ?.toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            call.reason
              .toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            call.destination_area
              ?.toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            call.action_taken
              ?.toLowerCase()
              .includes(
                normalizedSearch,
              ) ||
            call.created_by_name
              ?.toLowerCase()
              .includes(
                normalizedSearch,
              );

          const matchesArea =
            !normalizedArea ||
            call.destination_area
              ?.toLowerCase()
              .includes(
                normalizedArea,
              );

          const matchesAction =
            !actionFilter ||
            call.action_taken ===
              actionFilter;

          let matchesDateFrom =
            true;

          if (dateFrom) {
            const fromDate =
              new Date(
                `${dateFrom}T00:00:00`,
              );

            matchesDateFrom =
              callDate >= fromDate;
          }

          let matchesDateTo =
            true;

          if (dateTo) {
            const toDate =
              new Date(
                `${dateTo}T23:59:59`,
              );

            matchesDateTo =
              callDate <= toDate;
          }

          return (
            matchesSearch &&
            matchesArea &&
            matchesAction &&
            matchesDateFrom &&
            matchesDateTo
          );
        },
      );

      return [...filtered].sort(
        (a, b) => {
          const dateA = new Date(
            a.call_datetime ||
              a.created_at,
          ).getTime();

          const dateB = new Date(
            b.call_datetime ||
              b.created_at,
          ).getTime();

          return sortOrder === "desc"
            ? dateB - dateA
            : dateA - dateB;
        },
      );
    }, [
      calls,
      searchTerm,
      areaFilter,
      actionFilter,
      dateFrom,
      dateTo,
      sortOrder,
    ]);

  /*
   * PAGINACIÓN
   */
  const totalPages = Math.max(
    1,
    Math.ceil(filteredCalls.length / CALLS_PER_PAGE),
  );

  const paginatedCalls = useMemo(() => {
    const startIndex = (currentPage - 1) * CALLS_PER_PAGE;

    return filteredCalls.slice(
      startIndex,
      startIndex + CALLS_PER_PAGE,
    );
  }, [filteredCalls, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    dateFrom,
    dateTo,
    areaFilter,
    actionFilter,
    sortOrder,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1,
      );
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis", totalPages] as const;
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        "ellipsis",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ] as const;
    }

    return [
      1,
      "ellipsis",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "ellipsis",
      totalPages,
    ] as const;
  }, [currentPage, totalPages]);

  /*
   * NUMERACIÓN CRONOLÓGICA
   * La consulta más vieja es #1 y las siguientes continúan en orden.
   * Esta numeración no cambia al ordenar ni al filtrar.
   */
  const callNumberById = useMemo(() => {
    const chronologicalCalls = [...calls].sort((a, b) => {
      const dateA = new Date(
        a.call_datetime || a.created_at,
      ).getTime();

      const dateB = new Date(
        b.call_datetime || b.created_at,
      ).getTime();

      if (dateA !== dateB) {
        return dateA - dateB;
      }

      return a.id - b.id;
    });

    return new Map(
      chronologicalCalls.map((call, index) => [
        call.id,
        index + 1,
      ]),
    );
  }, [calls]);

  /*
   * LIMPIAR FILTROS
   */
  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setAreaFilter("");
    setActionFilter("");
    setCurrentPage(1);
  };

  const hasFilters =
    searchTerm.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    areaFilter.trim() !== "" ||
    actionFilter !== "";

  /*
   * ABRIR MODAL EDITAR
   */
  const openEditModal = (
    call: CallRecord,
  ) => {
    setEditingCall({
      id: call.id,

      callerName:
        call.caller_name || "",

      reason:
        call.reason || "",

      destinationArea:
        call.destination_area ||
        "",

      actionTaken:
        call.action_taken || "",

      callDateTime:
        toLocalDateTimeValue(
          call.call_datetime ||
            call.created_at,
        ),
    });
  };

  const closeEditModal = () => {
    if (savingEdit) {
      return;
    }

    setEditingCall(null);
  };

  /*
   * GUARDAR EDICIÓN
   */
  const handleSaveEdit =
    async () => {
      if (!editingCall) {
        return;
      }

      const cleanReason =
        editingCall.reason.trim();

      if (!cleanReason) {
        toast.error(
          "Ingresá el motivo de la llamada.",
        );

        return;
      }

      if (
        !editingCall.callDateTime
      ) {
        toast.error(
          "Ingresá la fecha y hora.",
        );

        return;
      }

      try {
        setSavingEdit(true);

        const editedDate =
          new Date(
            editingCall.callDateTime,
          );

        const { error } =
          await supabase
            .from("call_records")
            .update({
              caller_name:
                editingCall.callerName
                  .trim() || null,

              reason:
                cleanReason,

              destination_area:
                editingCall
                  .destinationArea
                  .trim() || null,

              action_taken:
                editingCall
                  .actionTaken ||
                null,

              call_datetime:
                editedDate.toISOString(),
            })
            .eq(
              "id",
              editingCall.id,
            );

        if (error) {
          console.error(
            "Error editando llamada:",
            error,
          );

          toast.error(
            "No se pudo actualizar la llamada.",
          );

          return;
        }

        toast.success(
          "Llamada actualizada correctamente.",
        );

        setEditingCall(null);

        await fetchCalls();
      } catch (error) {
        console.error(
          "Error editando llamada:",
          error,
        );

        toast.error(
          "Ocurrió un error al actualizar la llamada.",
        );
      } finally {
        setSavingEdit(false);
      }
    };

  /*
   * ELIMINAR LLAMADA
   */
  const openDeleteModal = (
    call: CallRecord,
  ) => {
    setCallToDelete(call);
  };

  const closeDeleteModal = () => {
    if (deletingCallId !== null) {
      return;
    }

    setCallToDelete(null);
  };

  const handleDeleteCall = async () => {
    if (!callToDelete) {
      return;
    }

    try {
      setDeletingCallId(callToDelete.id);

      const { error } = await supabase
        .from("call_records")
        .delete()
        .eq("id", callToDelete.id);

      if (error) {
        console.error(
          "Error eliminando llamada:",
          error,
        );

        toast.error(
          "No se pudo eliminar la llamada.",
        );

        return;
      }

      toast.success(
        "Llamada eliminada correctamente.",
      );

      setCallToDelete(null);

      await fetchCalls();
    } catch (error) {
      console.error(
        "Error inesperado eliminando llamada:",
        error,
      );

      toast.error(
        "Ocurrió un error al eliminar la llamada.",
      );
    } finally {
      setDeletingCallId(null);
    }
  };

  /*
   * EXPORTAR PDF
   */
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

          canvas.width =
            image.width * 2;

          canvas.height =
            image.height * 2;

          const ctx =
            canvas.getContext(
              "2d",
            );

          if (!ctx) {
            reject(
              new Error(
                "No se pudo procesar la imagen",
              ),
            );

            return;
          }

          ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height,
          );

          resolve(
            canvas.toDataURL(
              "image/png",
            ),
          );
        };

        image.onerror = () =>
          reject(
            new Error(
              "No se pudo cargar el logo",
            ),
          );

        image.src = src;
      },
    );
  };

  const exportToPDF = async () => {
    if (
      filteredCalls.length === 0
    ) {
      toast.error(
        "No hay llamadas para exportar.",
      );

      return;
    }

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      /*
       * LOGO
       */
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
          "PNG",
          14,
          10,
          34,
          12,
        );
      }

      /*
       * ENCABEZADO
       */
      doc.setFontSize(18);

      doc.setTextColor(
        30,
        41,
        59,
      );

      doc.text(
        "Registro de Consultas Derivadas",
        52,
        15,
      );

      doc.setFontSize(10);

      doc.setTextColor(
        71,
        85,
        105,
      );

      doc.text(
        "Secretaría de Ambiente y Servicios Públicos - General Pico",
        52,
        21,
      );

      doc.text(
        `Cantidad de llamadas exportadas: ${filteredCalls.length}`,
        14,
        31,
      );

      doc.text(
        `Fecha de exportación: ${new Date().toLocaleString(
          "es-AR",
        )}`,
        14,
        37,
      );

      let startY = 44;

      if (hasFilters) {
        doc.setFontSize(9);

        doc.setTextColor(
          100,
          116,
          139,
        );

        doc.text(
          "El reporte contiene únicamente los registros que coinciden con los filtros aplicados.",
          14,
          42,
        );

        startY = 48;
      }

      /*
       * TABLA
       */
      const tableData =
        filteredCalls.map(
          (call, index) => [
            String(index + 1),

            formatDateTime(
              call.call_datetime ||
                call.created_at,
            ),

            call.caller_name ||
              "Sin nombre",

            call.reason,

            call.destination_area ||
              "Sin especificar",

            call.action_taken ||
              "Sin especificar",

            call.created_by_name ||
              "Sin identificar",
          ],
        );

      autoTable(doc, {
        startY,

        head: [
          [
            "N°",
            "Fecha y hora",
            "Nombre",
            "Motivo",
            "Área",
            "Acción",
            "Cargado por",
          ],
        ],

        body: tableData,

        theme: "grid",

        showHead: "everyPage",

        pageBreak: "auto",

        rowPageBreak: "avoid",

        margin: {
          top: startY,
          right: 10,
          bottom: 16,
          left: 10,
        },

        styles: {
          fontSize: 7.5,

          cellPadding: 1.8,

          overflow: "linebreak",

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

          halign: "center",
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
            cellWidth: 12,
            halign: "center",
          },

          1: {
            cellWidth: 30,
          },

          2: {
            cellWidth: 32,
          },

          3: {
            cellWidth: 82,
          },

          4: {
            cellWidth: 30,
          },

          5: {
            cellWidth: 52,
          },

          6: {
            cellWidth: 40,
          },
        },
      });

      /*
       * PIE DE PÁGINA
       */
      const totalPages =
        doc.getNumberOfPages();

      for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber += 1
      ) {
        doc.setPage(
          pageNumber,
        );

        const pageWidth =
          doc.internal.pageSize.getWidth();

        const pageHeight =
          doc.internal.pageSize.getHeight();

        doc.setDrawColor(
          226,
          232,
          240,
        );

        doc.line(
          14,
          pageHeight - 13,
          pageWidth - 14,
          pageHeight - 13,
        );

        doc.setFontSize(8);

        doc.setTextColor(
          100,
          116,
          139,
        );

        doc.text(
          "Sistema Integral SAySSPP",
          14,
          pageHeight - 8,
        );

        doc.text(
          `Página ${pageNumber} de ${totalPages}`,
          pageWidth - 32,
          pageHeight - 8,
        );
      }

      /*
       * GUARDAR
       */
      const fileDate =
        new Date()
          .toISOString()
          .slice(0, 10);

      doc.save(
        `llamadas_desviadas_${fileDate}.pdf`,
      );

      toast.success(
        "PDF de consultas derivadas exportado correctamente.",
      );
    } catch (error) {
      console.error(
        "Error exportando PDF:",
        error,
      );

      toast.error(
        "Error al exportar el PDF.",
      );
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* ENCABEZADO */}
        <div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              router.push(
                "/dashboard/complaints/home",
              )
            }
            className="-ml-3 mb-2 text-muted-foreground"
            disabled={saving}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#00A27F]/10 p-3">
              <PhoneForwarded className="h-6 w-6 text-[#00A27F]" />
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Registrar consulta derivada
              </h1>

              <p className="mt-1 text-muted-foreground">
                Registrá el motivo de una consulta que no corresponde a un reclamo.
              </p>
            </div>
          </div>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit}>
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-lg">
                Datos de la consulta 
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 p-5">
              {/* FECHA + NOMBRE */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="callDateTime"
                    className="flex items-center gap-2"
                  >
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />

                    Fecha y hora
                  </Label>

                  <Input
                    id="callDateTime"
                    type="datetime-local"
                    value={callDateTime}
                    onChange={(event) =>
                      setCallDateTime(
                        event.target.value,
                      )
                    }
                    disabled={saving}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="callerName"
                    className="flex items-center gap-2"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />

                    Nombre de quien llama

                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>

                  <Input
                    id="callerName"
                    value={callerName}
                    onChange={(event) =>
                      setCallerName(
                        event.target.value,
                      )
                    }
                    placeholder="Ej.: María Gómez"
                    disabled={saving}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              {/* MOTIVO */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="reason"
                  className="flex items-center gap-2"
                >
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />

                  Motivo de la consulta

                  <span className="text-red-500">
                    *
                  </span>
                </Label>

                <textarea
                  id="reason"
                  value={reason}
                  onChange={(
                    event: ChangeEvent<HTMLTextAreaElement>,
                  ) =>
                    setReason(
                      event.target.value,
                    )
                  }
                  placeholder="Ej.: Llama para consultar por licencia de conducir..."
                  rows={3}
                  disabled={saving}
                  className="flex min-h-[85px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* ÁREA + ACCIÓN */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="destinationArea"
                    className="flex items-center gap-2"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground" />

                    Área correspondiente

                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>

                  <Input
                    id="destinationArea"
                    value={destinationArea}
                    onChange={(event) =>
                      setDestinationArea(
                        event.target.value,
                      )
                    }
                    placeholder="Ej.: Rentas"
                    disabled={saving}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="actionTaken">
                    Acción realizada

                    <span className="ml-1 font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>

                  <select
                    id="actionTaken"
                    value={actionTaken}
                    onChange={(event) =>
                      setActionTaken(
                        event.target.value,
                      )
                    }
                    disabled={saving}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      Seleccionar acción
                    </option>

                    {ACTION_OPTIONS.map(
                      (action) => (
                        <option
                          key={action}
                          value={action}
                        >
                          {action}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {/* BOTONES */}
              <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    router.push(
                      "/dashboard/complaints/home",
                    )
                  }
                  disabled={saving}
                  className="h-10 rounded-xl px-5"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  disabled={
                    saving ||
                    !reason.trim() ||
                    !callDateTime
                  }
                  className="h-10 rounded-xl bg-[#00A27F] px-5 font-semibold text-white hover:bg-[#008568]"
                >
                  <Save className="mr-2 h-4 w-4" />

                  {saving
                    ? "Registrando..."
                    : "Registrar llamada"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* HISTORIAL */}
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <PhoneCall className="h-5 w-5 text-[#00A27F]" />

                  Consultas registradas
                </CardTitle>

                <p className="mt-1 text-sm text-muted-foreground">
                  Historial de consultas derivadas registradas en el sistema.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  {filteredCalls.length}{" "}
                  {filteredCalls.length === 1
                    ? "registro"
                    : "registros"}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setSortOrder((current) =>
                      current === "desc"
                        ? "asc"
                        : "desc",
                    )
                  }
                  className="h-10 rounded-xl"
                >
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  {sortOrder === "desc"
                    ? "Más nuevas primero"
                    : "Más viejas primero"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={exportToPDF}
                  disabled={
                    filteredCalls.length ===
                    0
                  }
                  className="h-10 rounded-xl"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-5">
            {/* FILTROS */}
            <div className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Search className="h-4 w-4" />
                Filtros
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="searchCall">
                    Buscar
                  </Label>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      id="searchCall"
                      value={searchTerm}
                      onChange={(event) =>
                        setSearchTerm(
                          event.target.value,
                        )
                      }
                      placeholder="Nombre, motivo, área, usuario..."
                      className="h-10 rounded-xl pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFrom">
                    Desde
                  </Label>

                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(event) =>
                      setDateFrom(
                        event.target.value,
                      )
                    }
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateTo">
                    Hasta
                  </Label>

                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(event) =>
                      setDateTo(
                        event.target.value,
                      )
                    }
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="areaFilter">
                    Área
                  </Label>

                  <Input
                    id="areaFilter"
                    value={areaFilter}
                    onChange={(event) =>
                      setAreaFilter(
                        event.target.value,
                      )
                    }
                    placeholder="Ej.: Rentas"
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full space-y-2 sm:max-w-sm">
                  <Label htmlFor="actionFilter">
                    Acción realizada
                  </Label>

                  <select
                    id="actionFilter"
                    value={actionFilter}
                    onChange={(event) =>
                      setActionFilter(
                        event.target.value,
                      )
                    }
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">
                      Todas las acciones
                    </option>

                    {ACTION_OPTIONS.map(
                      (action) => (
                        <option
                          key={action}
                          value={action}
                        >
                          {action}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                  disabled={!hasFilters}
                  className="h-10 rounded-xl"
                >
                  <FilterX className="mr-2 h-4 w-4" />
                  Limpiar filtros
                </Button>
              </div>
            </div>

            {/* REGISTROS */}
            {loadingCalls ? (
              <div className="py-10 text-center text-muted-foreground">
                Cargando llamadas...
              </div>
            ) : filteredCalls.length ===
              0 ? (
              <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                <PhoneCall className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                <p className="font-medium text-foreground">
                  No se encontraron llamadas
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  No hay registros que coincidan con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedCalls.map(
                  (call, index) => (
                    <div
                      key={call.id}
                      className="rounded-xl border border-border bg-background px-4 py-3 transition-all hover:bg-muted/30 hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {call.caller_name ||
                                "Sin nombre"}
                            </span>

                            <span className="text-muted-foreground">
                              •
                            </span>

                            <span className="text-sm font-semibold text-[#00A27F]">
                              {formatDateTime(
                                call.call_datetime ||
                                  call.created_at,
                              )}
                            </span>
                          </div>

                          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto_auto] lg:items-start">
                            <div>
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Motivo
                              </span>

                              <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                                {call.reason}
                              </p>
                            </div>

                            <div className="text-sm lg:min-w-[140px]">
                              <span className="text-muted-foreground">
                                Área:
                              </span>{" "}
                              <span className="font-medium text-foreground">
                                {call.destination_area ||
                                  "Sin especificar"}
                              </span>
                            </div>

                            <div className="text-sm lg:min-w-[190px]">
                              <span className="text-muted-foreground">
                                Acción:
                              </span>{" "}
                              <span className="font-medium text-foreground">
                                {call.action_taken ||
                                  "Sin especificar"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                            Cargado por:{" "}
                            <span className="font-semibold text-foreground">
                              {call.created_by_name ||
                                "Sin identificar"}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="inline-flex rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            #{callNumberById.get(call.id) ?? "-"}
                          </span>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openEditModal(
                                call,
                              )
                            }
                            disabled={
                              deletingCallId ===
                              call.id
                            }
                            className="h-8 rounded-lg"
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openDeleteModal(
                                call,
                              )
                            }
                            disabled={
                              deletingCallId !==
                              null
                            }
                            className="h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />

                            {deletingCallId ===
                            call.id
                              ? "Eliminando..."
                              : "Eliminar"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ),
                )}

                {totalPages > 1 && (
                  <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Página{" "}
                      <span className="font-semibold text-foreground">
                        {currentPage}
                      </span>{" "}
                      de{" "}
                      <span className="font-semibold text-foreground">
                        {totalPages}
                      </span>
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.max(1, page - 1),
                          )
                        }
                        disabled={currentPage <= 1}
                        className="h-9 w-9 rounded-xl"
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {paginationItems.map((item, index) =>
                        item === "ellipsis" ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="flex h-9 min-w-7 items-center justify-center px-1 text-sm font-medium text-muted-foreground"
                          >
                            ...
                          </span>
                        ) : (
                          <Button
                            key={item}
                            type="button"
                            variant={
                              currentPage === item
                                ? "default"
                                : "outline"
                            }
                            size="icon"
                            onClick={() =>
                              setCurrentPage(item)
                            }
                            className={`h-9 w-9 rounded-xl ${
                              currentPage === item
                                ? "bg-[#00A27F] text-white hover:bg-[#008568]"
                                : ""
                            }`}
                            aria-label={`Ir a la página ${item}`}
                            aria-current={
                              currentPage === item
                                ? "page"
                                : undefined
                            }
                          >
                            {item}
                          </Button>
                        ),
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(totalPages, page + 1),
                          )
                        }
                        disabled={currentPage >= totalPages}
                        className="h-9 w-9 rounded-xl"
                        aria-label="Página siguiente"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MODAL EDITAR */}
      {editingCall && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditModal();
            }
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Editar llamada
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Corregí los datos cargados en esta llamada.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeEditModal}
                disabled={savingEdit}
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="editDateTime">
                    Fecha y hora
                  </Label>

                  <Input
                    id="editDateTime"
                    type="datetime-local"
                    value={
                      editingCall.callDateTime
                    }
                    onChange={(event) =>
                      setEditingCall(
                        (current) =>
                          current
                            ? {
                                ...current,
                                callDateTime:
                                  event.target.value,
                              }
                            : null,
                      )
                    }
                    disabled={savingEdit}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editCaller">
                    Nombre de quien llama
                  </Label>

                  <Input
                    id="editCaller"
                    value={
                      editingCall.callerName
                    }
                    onChange={(event) =>
                      setEditingCall(
                        (current) =>
                          current
                            ? {
                                ...current,
                                callerName:
                                  event.target.value,
                              }
                            : null,
                      )
                    }
                    disabled={savingEdit}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editReason">
                  Motivo de la llamada

                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </Label>

                <textarea
                  id="editReason"
                  value={
                    editingCall.reason
                  }
                  onChange={(event) =>
                    setEditingCall(
                      (current) =>
                        current
                          ? {
                              ...current,
                              reason:
                                event.target.value,
                            }
                          : null,
                    )
                  }
                  rows={3}
                  disabled={savingEdit}
                  className="flex min-h-[85px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="editArea">
                    Área correspondiente
                  </Label>

                  <Input
                    id="editArea"
                    value={
                      editingCall.destinationArea
                    }
                    onChange={(event) =>
                      setEditingCall(
                        (current) =>
                          current
                            ? {
                                ...current,
                                destinationArea:
                                  event.target.value,
                              }
                            : null,
                      )
                    }
                    disabled={savingEdit}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editAction">
                    Acción realizada
                  </Label>

                  <select
                    id="editAction"
                    value={
                      editingCall.actionTaken
                    }
                    onChange={(event) =>
                      setEditingCall(
                        (current) =>
                          current
                            ? {
                                ...current,
                                actionTaken:
                                  event.target.value,
                              }
                            : null,
                      )
                    }
                    disabled={savingEdit}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">
                      Seleccionar acción
                    </option>

                    {ACTION_OPTIONS.map(
                      (action) => (
                        <option
                          key={action}
                          value={action}
                        >
                          {action}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border bg-muted/20 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditModal}
                disabled={savingEdit}
                className="rounded-xl"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void handleSaveEdit()
                }
                disabled={
                  savingEdit ||
                  !editingCall.reason.trim() ||
                  !editingCall.callDateTime
                }
                className="rounded-xl bg-[#00A27F] font-semibold text-white hover:bg-[#008568]"
              >
                <Save className="mr-2 h-4 w-4" />

                {savingEdit
                  ? "Guardando..."
                  : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {callToDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDeleteModal();
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    Eliminar llamada
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirmá la eliminación de esta llamada registrada.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeDeleteModal}
                disabled={deletingCallId !== null}
                className="shrink-0 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {callToDelete.caller_name || "Sin nombre"}
                  </span>

                  <span className="text-muted-foreground">
                    •
                  </span>

                  <span className="text-sm font-semibold text-[#00A27F]">
                    {formatDateTime(
                      callToDelete.call_datetime ||
                        callToDelete.created_at,
                    )}
                  </span>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Motivo
                  </p>

                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {callToDelete.reason}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      Área:
                    </span>{" "}
                    <span className="font-medium text-foreground">
                      {callToDelete.destination_area || "Sin especificar"}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground">
                      Acción:
                    </span>{" "}
                    <span className="font-medium text-foreground">
                      {callToDelete.action_taken || "Sin especificar"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/30">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Esta acción no se puede deshacer.
                </p>

                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  El registro se eliminará definitivamente del sistema.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border bg-muted/20 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                disabled={deletingCallId !== null}
                className="rounded-xl"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={() =>
                  void handleDeleteCall()
                }
                disabled={deletingCallId !== null}
                className="rounded-xl bg-red-600 font-semibold text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />

                {deletingCallId ===
                callToDelete.id
                  ? "Eliminando..."
                  : "Eliminar registro"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";

import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  backup_driver: string | null;

  image_path: string | null;
  image_thumb_path: string | null;

  active: boolean;

  deactivation_date: string | null;
  deactivation_reason: string | null;
};

type EditarVehiculoClientProps = {
  vehicle: Vehicle;
  userId: string;
};

type VehicleFormData = {
  code: string;
  vehicle: string;
  license_plate: string;

  vehicle_type: string;
  year: string;
  department: string;

  operational_status: string;
  repair_reason: string;
  out_of_service_reason: string;
  observations: string;

  rfid_tag: string;

  has_alltrack: boolean;
  has_ibutton_reader: boolean;
  has_camera: boolean;

  utilization: string;
  schedule: string;

  primary_driver_1: string;
  primary_driver_2: string;
  backup_driver: string;
};

const VEHICLE_TYPE_OPTIONS = [
  "Auto",
  "Camioneta",
  "Minibus",
  "Camión",
  "Camión portacontenedor",
  "Barredora",
  "Motoniveladora",
  "Tractor",
  "Retroexcavadora",
  "Cargadora",
  "Excavadora",
  "Otro",
];

const OPERATIONAL_STATUS_OPTIONS = [
  "Funcionando",
  "En reparación",
  "En funcionamiento con arreglos pendientes",
  "Fuera de servicio",
];

const DEPARTMENT_OPTIONS = [
  "GIRSU",
  "Servicios Públicos",
  "Dirección General",
  "Arbolado",
  "Suministros",
  "Otro",
];

const SCHEDULE_OPTIONS = [
  "04:00 a 10:30",
  "04:00 a 12:00",
  "04:00 a 13:30",
  "05:00 a 07:30 / 07:30 a 11:00",
  "05:30 a 13:30",
  "05:30 a 20:30",
  "06:00 a 13:00",
  "06:00 a 13:00 / 13:00 a 20:00",
  "06:00 a 17:00",
  "06:00 a 19:30",
  "06:00 a 20:00",
  "06:30 a 12:30 / 13:00 a 19:00",
  "06:30 a 13:00",
  "06:30 a 13:00 / 13:00 a 19:30",
  "06:30 a 13:30",
  "07:00 a 13:30",
  "Rotativo",
  "Todo el día",
  "Otro",
];

const isStandardSchedule = (
  value?: string | null,
) =>
  Boolean(
    value &&
      SCHEDULE_OPTIONS.includes(value) &&
      value !== "Otro",
  );


const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const cleanOptionalText = (value: string) => {
  const cleanValue = value.trim();

  return cleanValue || null;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const getImageExtension = (file: File) => {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    default:
      return "jpg";
  }
};


const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 480;
const THUMBNAIL_QUALITY = 0.72;

const createVehicleThumbnail = async (
  file: File,
): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");

    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = THUMBNAIL_HEIGHT;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "No se pudo preparar el thumbnail de la fotografía.",
      );
    }

    const scale = Math.max(
      THUMBNAIL_WIDTH / bitmap.width,
      THUMBNAIL_HEIGHT / bitmap.height,
    );

    const sourceWidth =
      THUMBNAIL_WIDTH / scale;

    const sourceHeight =
      THUMBNAIL_HEIGHT / scale;

    const sourceX =
      Math.max(
        0,
        (bitmap.width - sourceWidth) / 2,
      );

    const sourceY =
      Math.max(
        0,
        (bitmap.height - sourceHeight) / 2,
      );

    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      THUMBNAIL_WIDTH,
      THUMBNAIL_HEIGHT,
    );

    const blob =
      await new Promise<Blob | null>(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/webp",
            THUMBNAIL_QUALITY,
          );
        },
      );

    if (!blob) {
      throw new Error(
        "No se pudo generar el thumbnail WEBP.",
      );
    }

    return blob;
  } finally {
    bitmap.close();
  }
};

export function EditarVehiculoClient({
  vehicle,
  userId,
}: EditarVehiculoClientProps) {
  const router = useRouter();

  const [formData, setFormData] =
    useState<VehicleFormData>({
      code: vehicle.code || "",
      vehicle: vehicle.vehicle || "",
      license_plate: vehicle.license_plate || "",

      vehicle_type: vehicle.vehicle_type || "",
      year: vehicle.year ? String(vehicle.year) : "",
      department: vehicle.department || "",

      operational_status:
        vehicle.operational_status || "Funcionando",

      repair_reason: vehicle.repair_reason || "",
      out_of_service_reason:
        vehicle.out_of_service_reason || "",
      observations: vehicle.observations || "",

      rfid_tag: vehicle.rfid_tag || "",

      has_alltrack: vehicle.has_alltrack,
      has_ibutton_reader:
        vehicle.has_ibutton_reader,
      has_camera: vehicle.has_camera,

      utilization: vehicle.utilization || "",
      schedule: vehicle.schedule || "",

      primary_driver_1:
        vehicle.primary_driver_1 || "",

      primary_driver_2:
        vehicle.primary_driver_2 || "",

      backup_driver:
        vehicle.backup_driver || "",
    });

  const [saving, setSaving] = useState(false);

  /*
   * Si el vehículo ya tiene un horario que no está en las
   * opciones normalizadas, lo tratamos automáticamente como "Otro"
   * y lo mostramos en el input personalizado sin perder el dato.
   */
  const [
    useCustomSchedule,
    setUseCustomSchedule,
  ] = useState(
    Boolean(
      vehicle.schedule &&
        !isStandardSchedule(
          vehicle.schedule,
        ),
    ),
  );

  const [
    customSchedule,
    setCustomSchedule,
  ] = useState(
    vehicle.schedule &&
      !isStandardSchedule(
        vehicle.schedule,
      )
      ? vehicle.schedule
      : "",
  );

  const imageInputRef =
    useRef<HTMLInputElement | null>(null);

  const [
    currentImageUrl,
    setCurrentImageUrl,
  ] = useState<string | null>(null);

  const [
    currentImageLoading,
    setCurrentImageLoading,
  ] = useState(
    Boolean(
      vehicle.image_thumb_path ||
        vehicle.image_path,
    ),
  );

  const [
    selectedImage,
    setSelectedImage,
  ] = useState<File | null>(null);

  const [
    newImagePreviewUrl,
    setNewImagePreviewUrl,
  ] = useState<string | null>(null);

  /*
   * Cargamos la foto actual desde el bucket privado.
   */
  useEffect(() => {
    let cancelled = false;

    const loadCurrentImage = async () => {
      const imagePath =
        vehicle.image_thumb_path ||
        vehicle.image_path;

      if (!imagePath) {
        setCurrentImageUrl(null);
        setCurrentImageLoading(false);
        return;
      }

      try {
        setCurrentImageLoading(true);

        const supabase = createClient();

        const {
          data,
          error,
        } = await supabase.storage
          .from("vehicle-images")
          .createSignedUrl(
            imagePath,
            60 * 60 * 24,
          );

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setCurrentImageUrl(
            data?.signedUrl || null,
          );
        }
      } catch (error) {
        console.error(
          "Error cargando la fotografía actual:",
          error,
        );

        if (!cancelled) {
          setCurrentImageUrl(null);
        }
      } finally {
        if (!cancelled) {
          setCurrentImageLoading(false);
        }
      }
    };

    void loadCurrentImage();

    return () => {
      cancelled = true;
    };
  }, [
    vehicle.image_thumb_path,
    vehicle.image_path,
  ]);

  /*
   * Liberamos la URL local de previsualización.
   */
  useEffect(() => {
    return () => {
      if (newImagePreviewUrl) {
        URL.revokeObjectURL(
          newImagePreviewUrl,
        );
      }
    };
  }, [newImagePreviewUrl]);

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type,
      )
    ) {
      toast.error(
        "La fotografía debe ser JPG, PNG o WEBP.",
      );

      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(
        "La fotografía no puede superar los 5 MB.",
      );

      event.target.value = "";
      return;
    }

    if (newImagePreviewUrl) {
      URL.revokeObjectURL(
        newImagePreviewUrl,
      );
    }

    setSelectedImage(file);

    setNewImagePreviewUrl(
      URL.createObjectURL(file),
    );
  };

  const handleCancelNewImage = () => {
    if (newImagePreviewUrl) {
      URL.revokeObjectURL(
        newImagePreviewUrl,
      );
    }

    setSelectedImage(null);
    setNewImagePreviewUrl(null);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleChange = (
    field: keyof VehicleFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.code.trim()) {
      toast.error("Ingresá el código del vehículo");
      return false;
    }

    if (!formData.vehicle.trim()) {
      toast.error(
        "Ingresá el nombre o descripción del vehículo",
      );
      return false;
    }

    if (formData.year.trim()) {
      const year = Number(formData.year);
      const currentYear = new Date().getFullYear();

      if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > currentYear + 1
      ) {
        toast.error(
          `Ingresá un año válido entre 1900 y ${currentYear + 1}`,
        );

        return false;
      }
    }

    if (
      useCustomSchedule &&
      !formData.schedule.trim()
    ) {
      toast.error(
        "Ingresá la franja horaria personalizada",
      );

      return false;
    }

    return true;
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);

      const supabase = createClient();

      const normalizedCode =
        formData.code.trim().toUpperCase();

      /*
       * Buscamos si existe OTRO vehículo con este código.
       */
      const { data: duplicateVehicle, error: duplicateError } =
        await supabase
          .from("vehicles")
          .select("id, code")
          .ilike("code", normalizedCode)
          .neq("id", vehicle.id)
          .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (duplicateVehicle) {
        toast.error(
          `Ya existe otro vehículo con el código ${duplicateVehicle.code}`,
        );

        return;
      }

      const year = formData.year.trim()
        ? Number(formData.year)
        : null;

      /*
       * Si el estado deja de ser "En reparación",
       * limpiamos el motivo de reparación.
       */
      const currentStatus = normalizeText(
        formData.operational_status,
      );

      const repairReason =
        currentStatus.includes("reparacion") ||
        currentStatus.includes("arreglos")
          ? cleanOptionalText(formData.repair_reason)
          : null;

      /*
       * Si deja de estar fuera de servicio,
       * limpiamos ese motivo.
       */
      const outOfServiceReason =
        currentStatus.includes("fuera")
          ? cleanOptionalText(
              formData.out_of_service_reason,
            )
          : null;

      /*
       * Si eligieron una nueva foto, primero la subimos con
       * un nombre nuevo. Recién después actualizamos image_path.
       *
       * Así evitamos pisar la foto anterior antes de saber
       * que la actualización de la BD salió bien.
       */
      let nextImagePath =
        vehicle.image_path;

      let nextImageThumbPath =
        vehicle.image_thumb_path;

      let uploadedImagePath:
        | string
        | null = null;

      let uploadedThumbPath:
        | string
        | null = null;

      if (selectedImage) {
        const extension =
          getImageExtension(
            selectedImage,
          );

        const version =
          Date.now();

        uploadedImagePath =
          `${vehicle.id}/principal-${version}.${extension}`;

        uploadedThumbPath =
          `${vehicle.id}/thumbnail-${version}.webp`;

        /*
         * Generamos primero la miniatura en memoria.
         * Si esto falla, todavía no tocamos Storage.
         */
        const thumbnailBlob =
          await createVehicleThumbnail(
            selectedImage,
          );

        const {
          error: uploadError,
        } = await supabase.storage
          .from("vehicle-images")
          .upload(
            uploadedImagePath,
            selectedImage,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                selectedImage.type,
            },
          );

        if (uploadError) {
          throw new Error(
            `No se pudo subir la nueva fotografía: ${uploadError.message}`,
          );
        }

        const {
          error: thumbnailUploadError,
        } = await supabase.storage
          .from("vehicle-images")
          .upload(
            uploadedThumbPath,
            thumbnailBlob,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                "image/webp",
            },
          );

        if (thumbnailUploadError) {
          await supabase.storage
            .from("vehicle-images")
            .remove([
              uploadedImagePath,
            ]);

          throw new Error(
            `No se pudo subir el nuevo thumbnail: ${thumbnailUploadError.message}`,
          );
        }

        nextImagePath =
          uploadedImagePath;

        nextImageThumbPath =
          uploadedThumbPath;
      }

      const { error } = await supabase
        .from("vehicles")
        .update({
          code: normalizedCode,

          vehicle: formData.vehicle.trim(),

          license_plate: formData.license_plate.trim()
            ? formData.license_plate
                .trim()
                .toUpperCase()
            : null,

          vehicle_type: cleanOptionalText(
            formData.vehicle_type,
          ),

          year,

          department: cleanOptionalText(
            formData.department,
          ),

          operational_status: cleanOptionalText(
            formData.operational_status,
          ),

          repair_reason: repairReason,

          out_of_service_reason:
            outOfServiceReason,

          observations: cleanOptionalText(
            formData.observations,
          ),

          rfid_tag: formData.rfid_tag.trim()
            ? formData.rfid_tag
                .trim()
                .toUpperCase()
            : null,

          has_alltrack:
            formData.has_alltrack,

          has_ibutton_reader:
            formData.has_ibutton_reader,

          has_camera:
            formData.has_camera,

          utilization: cleanOptionalText(
            formData.utilization,
          ),

          schedule: cleanOptionalText(
            formData.schedule,
          ),

          primary_driver_1: cleanOptionalText(
            formData.primary_driver_1,
          ),

          primary_driver_2: cleanOptionalText(
            formData.primary_driver_2,
          ),

          backup_driver: cleanOptionalText(
            formData.backup_driver,
          ),

          image_path:
            nextImagePath,

          image_thumb_path:
            nextImageThumbPath,

          updated_by: userId,
        })
        .eq("id", vehicle.id);

      if (error) {
        /*
         * Si habíamos subido una foto nueva pero falló
         * la actualización de la BD, la eliminamos para
         * no dejar archivos huérfanos.
         */
        const newlyUploadedFiles = [
          uploadedImagePath,
          uploadedThumbPath,
        ].filter(
          (path): path is string =>
            Boolean(path),
        );

        if (
          newlyUploadedFiles.length > 0
        ) {
          await supabase.storage
            .from("vehicle-images")
            .remove(
              newlyUploadedFiles,
            );
        }

        if (error.code === "23505") {
          toast.error(
            "Ya existe otro vehículo con ese código.",
          );
          return;
        }

        throw error;
      }

      /*
       * La BD ya apunta a la nueva foto.
       * Ahora sí podemos borrar la anterior.
       */
      if (selectedImage) {
        const oldFiles = [
          vehicle.image_path,
          vehicle.image_thumb_path,
        ].filter(
          (path): path is string =>
            Boolean(path),
        );

        const filesToRemove =
          oldFiles.filter(
            (path) =>
              path !== nextImagePath &&
              path !== nextImageThumbPath,
          );

        if (
          filesToRemove.length > 0
        ) {
          const {
            error:
              removeOldFilesError,
          } = await supabase.storage
            .from("vehicle-images")
            .remove(
              filesToRemove,
            );

          if (removeOldFilesError) {
            console.warn(
              "El vehículo se actualizó, pero no se pudieron eliminar todos los archivos anteriores:",
              removeOldFilesError,
            );
          }
        }
      }

      toast.success(
        selectedImage
          ? "Vehículo actualizado correctamente"
          : "Vehículo actualizado correctamente",
      );

      router.push(
        `/dashboard/planta-vehicular/${vehicle.id}`,
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Error actualizando vehículo:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el vehículo",
      );
    } finally {
      setSaving(false);
    }
  };

  const statusNormalized = normalizeText(
    formData.operational_status,
  );

  const showRepairReason =
    statusNormalized.includes("reparacion") ||
    statusNormalized.includes("arreglos");

  const showOutOfServiceReason =
    statusNormalized.includes("fuera");

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          className="-ml-2 mb-4 gap-2"
          onClick={() =>
            router.push(
              `/dashboard/planta-vehicular/${vehicle.id}`,
            )
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la ficha
        </Button>

        <h1 className="text-3xl font-bold tracking-tight">
          Editar vehículo
        </h1>

        <p className="mt-2 text-muted-foreground">
          Modificá los datos de {vehicle.code} —{" "}
          {vehicle.vehicle}.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>
              Fotografía del vehículo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <input
              ref={imageInputRef}
              id="vehicle-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              disabled={saving}
              className="hidden"
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Fotografía actual
                </Label>

                <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border bg-muted/20">
                  {currentImageLoading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />

                      <span className="text-sm">
                        Cargando fotografía...
                      </span>
                    </div>
                  ) : currentImageUrl ? (
                    <img
                      src={currentImageUrl}
                      alt={`${vehicle.code} - ${vehicle.vehicle}`}
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      className="h-[300px] w-full object-contain p-2"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <ImagePlus className="h-10 w-10" />

                      <span className="text-sm">
                        Sin fotografía cargada
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Nueva fotografía
                </Label>

                {newImagePreviewUrl ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border bg-muted/20">
                      <img
                        src={newImagePreviewUrl}
                        alt="Previsualización de la nueva fotografía"
                        className="h-[300px] w-full object-contain p-2"
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() =>
                          imageInputRef.current?.click()
                        }
                      >
                        <ImagePlus className="mr-2 h-4 w-4" />
                        Elegir otra
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={
                          handleCancelNewImage
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Cancelar cambio
                      </Button>
                    </div>

                    {selectedImage && (
                      <p className="text-xs text-muted-foreground">
                        Archivo seleccionado: {selectedImage.name}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      imageInputRef.current?.click()
                    }
                    className="flex min-h-[260px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/10 p-6 text-center transition-colors hover:bg-muted/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="rounded-full border p-4">
                      <ImagePlus className="h-7 w-7 text-muted-foreground" />
                    </div>

                    <div>
                      <p className="font-medium">
                        Cambiar fotografía
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        JPG, PNG o WEBP. Máximo 5 MB.
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <FieldHelp>
              Si no seleccionás una nueva fotografía, se conservarán la imagen
              actual.
            </FieldHelp>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Identificación
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FormField
                label="Código"
                required
              >
                <Input
                  value={formData.code}
                  onChange={(event) =>
                    handleChange(
                      "code",
                      event.target.value,
                    )
                  }
                  placeholder="Ej: S.P.8"
                />

                <FieldHelp>
                  El código se usa para identificar al
                  vehículo en distintos módulos del sistema.
                  Modificalo solamente si corresponde.
                </FieldHelp>
              </FormField>

              <FormField
                label="Vehículo"
                required
              >
                <Input
                  value={formData.vehicle}
                  onChange={(event) =>
                    handleChange(
                      "vehicle",
                      event.target.value,
                    )
                  }
                />
              </FormField>

              <FormField label="Dominio">
                <Input
                  value={
                    formData.license_plate
                  }
                  onChange={(event) =>
                    handleChange(
                      "license_plate",
                      event.target.value,
                    )
                  }
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FormField label="Tipo de vehículo">
                <Select
                  value={
                    formData.vehicle_type
                  }
                  onValueChange={(value) =>
                    handleChange(
                      "vehicle_type",
                      value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>

                  <SelectContent>
                    {VEHICLE_TYPE_OPTIONS.map(
                      (option) => (
                        <SelectItem
                          key={option}
                          value={option}
                        >
                          {option}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Año">
                <Input
                  type="number"
                  min={1900}
                  max={
                    new Date().getFullYear() + 1
                  }
                  value={formData.year}
                  onChange={(event) =>
                    handleChange(
                      "year",
                      event.target.value,
                    )
                  }
                />
              </FormField>

              <FormField label="Dirección">
                <Select
                  value={formData.department}
                  onValueChange={(value) =>
                    handleChange(
                      "department",
                      value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar dirección" />
                  </SelectTrigger>

                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map(
                      (option) => (
                        <SelectItem
                          key={option}
                          value={option}
                        >
                          {option}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Estado operativo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField label="Condición">
                <Select
                  value={
                    formData.operational_status
                  }
                  onValueChange={(value) =>
                    handleChange(
                      "operational_status",
                      value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {OPERATIONAL_STATUS_OPTIONS.map(
                      (option) => (
                        <SelectItem
                          key={option}
                          value={option}
                        >
                          {option}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </FormField>

              {showRepairReason && (
                <FormField label="Motivo de reparación">
                  <Input
                    value={
                      formData.repair_reason
                    }
                    onChange={(event) =>
                      handleChange(
                        "repair_reason",
                        event.target.value,
                      )
                    }
                  />
                </FormField>
              )}

              {showOutOfServiceReason && (
                <FormField label="Motivo fuera de servicio">
                  <Input
                    value={
                      formData.out_of_service_reason
                    }
                    onChange={(event) =>
                      handleChange(
                        "out_of_service_reason",
                        event.target.value,
                      )
                    }
                  />
                </FormField>
              )}
            </div>

            <FormField label="Observaciones">
              <textarea
                value={formData.observations}
                onChange={(event) =>
                  handleChange(
                    "observations",
                    event.target.value,
                  )
                }
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Equipamiento y tecnología
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField label="N° TAG RFID">
                <Input
                  value={formData.rfid_tag}
                  onChange={(event) =>
                    handleChange(
                      "rfid_tag",
                      event.target.value,
                    )
                  }
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <BooleanField
                label="¿Posee ALLTRACK?"
                value={formData.has_alltrack}
                onChange={(value) =>
                  handleChange(
                    "has_alltrack",
                    value,
                  )
                }
              />

              <BooleanField
                label="¿Posee lector iButton?"
                value={
                  formData.has_ibutton_reader
                }
                onChange={(value) =>
                  handleChange(
                    "has_ibutton_reader",
                    value,
                  )
                }
              />

              <BooleanField
                label="¿Posee cámara?"
                value={formData.has_camera}
                onChange={(value) =>
                  handleChange(
                    "has_camera",
                    value,
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Utilización y responsables
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField label="Utilización">
                <Input
                  value={formData.utilization}
                  onChange={(event) =>
                    handleChange(
                      "utilization",
                      event.target.value,
                    )
                  }
                />
              </FormField>

              <FormField label="Franja horaria">
                <div className="space-y-3">
                  <Select
                    value={
                      useCustomSchedule
                        ? "Otro"
                        : formData.schedule
                    }
                    onValueChange={(value) => {
                      if (value === "Otro") {
                        /*
                         * Al pasar a "Otro", si ya existía un horario
                         * personalizado lo conservamos. Si venía de una
                         * opción estándar, empezamos el campo vacío.
                         */
                        const currentIsCustom =
                          Boolean(
                            formData.schedule &&
                              !isStandardSchedule(
                                formData.schedule,
                              ),
                          );

                        const nextCustomValue =
                          currentIsCustom
                            ? formData.schedule
                            : "";

                        setUseCustomSchedule(
                          true,
                        );

                        setCustomSchedule(
                          nextCustomValue,
                        );

                        handleChange(
                          "schedule",
                          nextCustomValue,
                        );

                        return;
                      }

                      setUseCustomSchedule(
                        false,
                      );

                      setCustomSchedule("");

                      handleChange(
                        "schedule",
                        value,
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar franja horaria" />
                    </SelectTrigger>

                    <SelectContent>
                      {SCHEDULE_OPTIONS.map(
                        (option) => (
                          <SelectItem
                            key={option}
                            value={option}
                          >
                            {option}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  {useCustomSchedule && (
                    <div className="space-y-2">
                      <Input
                        value={customSchedule}
                        onChange={(event) => {
                          const value =
                            event.target.value;

                          setCustomSchedule(
                            value,
                          );

                          handleChange(
                            "schedule",
                            value,
                          );
                        }}
                        placeholder="Ej: 08:00 a 14:00"
                        autoComplete="off"
                      />

                      <FieldHelp>
                        Este vehículo usa una franja horaria personalizada.
                        Si la modificás, se guardará exactamente el valor
                        ingresado.
                      </FieldHelp>
                    </div>
                  )}

                  {!useCustomSchedule &&
                    !formData.schedule && (
                      <FieldHelp>
                        La franja horaria es opcional.
                      </FieldHelp>
                    )}
                </div>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FormField label="Chofer titular 1">
                <Input
                  value={
                    formData.primary_driver_1
                  }
                  onChange={(event) =>
                    handleChange(
                      "primary_driver_1",
                      event.target.value,
                    )
                  }
                  placeholder="Nombre y apellido"
                />
              </FormField>

              <FormField label="Chofer titular 2">
                <Input
                  value={
                    formData.primary_driver_2
                  }
                  onChange={(event) =>
                    handleChange(
                      "primary_driver_2",
                      event.target.value,
                    )
                  }
                  placeholder="Nombre y apellido"
                />
              </FormField>

              <FormField label="Chofer suplente">
                <Input
                  value={
                    formData.backup_driver
                  }
                  onChange={(event) =>
                    handleChange(
                      "backup_driver",
                      event.target.value,
                    )
                  }
                  placeholder="Nombre y apellido"
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col-reverse gap-3 py-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() =>
                router.push(
                  `/dashboard/planta-vehicular/${vehicle.id}`,
                )
              }
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando cambios...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}

        {required && (
          <span className="ml-1 text-destructive">
            *
          </span>
        )}
      </Label>

      {children}
    </div>
  );
}

function FieldHelp({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function BooleanField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <Select
        value={value ? "SI" : "NO"}
        onValueChange={(nextValue) =>
          onChange(nextValue === "SI")
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="SI">
            Sí
          </SelectItem>

          <SelectItem value="NO">
            No
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
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

type NuevoVehiculoClientProps = {
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

const INITIAL_FORM_DATA: VehicleFormData = {
  code: "",
  vehicle: "",
  license_plate: "",

  vehicle_type: "",
  year: "",
  department: "",

  operational_status: "Funcionando",
  repair_reason: "",
  out_of_service_reason: "",
  observations: "",

  rfid_tag: "",

  has_alltrack: false,
  has_ibutton_reader: false,
  has_camera: false,

  utilization: "",
  schedule: "",

  primary_driver_1: "",
  primary_driver_2: "",
  backup_driver: "",
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

    /*
     * Recorte tipo "cover":
     * llenamos 640x480 sin deformar la imagen.
     */
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

export function NuevoVehiculoClient({
  userId,
}: NuevoVehiculoClientProps) {
  const router = useRouter();

  const [formData, setFormData] =
    useState<VehicleFormData>(INITIAL_FORM_DATA);

  const [saving, setSaving] = useState(false);

  const [
    customSchedule,
    setCustomSchedule,
  ] = useState("");

  const [
    useCustomSchedule,
    setUseCustomSchedule,
  ] = useState(false);

  const imageInputRef =
    useRef<HTMLInputElement | null>(null);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState<File | null>(null);

  const [
    imagePreviewUrl,
    setImagePreviewUrl,
  ] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(
          imagePreviewUrl,
        );
      }
    };
  }, [imagePreviewUrl]);

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

    if (imagePreviewUrl) {
      URL.revokeObjectURL(
        imagePreviewUrl,
      );
    }

    setSelectedImage(file);

    setImagePreviewUrl(
      URL.createObjectURL(file),
    );
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(
        imagePreviewUrl,
      );
    }

    setSelectedImage(null);
    setImagePreviewUrl(null);

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
      toast.error("Ingresá el nombre o descripción del vehículo");
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

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);

      const supabase = createClient();

      /*
       * Antes de insertar comprobamos el código.
       *
       * La BD además tiene UNIQUE en code, por lo que
       * seguimos estando protegidos ante una carga duplicada.
       */
      const normalizedCode = formData.code.trim();

      const { data: existingVehicle, error: checkError } =
        await supabase
          .from("vehicles")
          .select("id, code")
          .ilike("code", normalizedCode)
          .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existingVehicle) {
        toast.error(
          `Ya existe un vehículo con el código ${existingVehicle.code}`,
        );

        return;
      }

      const year = formData.year.trim()
        ? Number(formData.year)
        : null;

      /*
       * IMPORTANTE:
       * Generamos el UUID ANTES de crear el registro.
       *
       * Si hay foto, la subimos primero usando ese UUID.
       * Después hacemos UN SOLO INSERT en vehicles con image_path
       * ya cargado.
       *
       * Así el historial registra únicamente:
       * "Vehículo incorporado"
       *
       * y NO genera un segundo evento ficticio:
       * "Imagen: Sin dato -> ..."
       */
      const vehicleId =
        crypto.randomUUID();

      let imagePath:
        | string
        | null = null;

      let imageThumbPath:
        | string
        | null = null;

      if (selectedImage) {
        const extension =
          getImageExtension(
            selectedImage,
          );

        imagePath =
          `${vehicleId}/principal.${extension}`;

        imageThumbPath =
          `${vehicleId}/thumbnail.webp`;

        /*
         * Generamos el thumbnail ANTES de subir archivos.
         * Si falla esta etapa, todavía no dejamos nada en Storage.
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
            imagePath,
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
            `No se pudo subir la fotografía: ${uploadError.message}`,
          );
        }

        const {
          error: thumbnailUploadError,
        } = await supabase.storage
          .from("vehicle-images")
          .upload(
            imageThumbPath,
            thumbnailBlob,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                "image/webp",
            },
          );

        if (thumbnailUploadError) {
          /*
           * Si falla el thumbnail, quitamos la original recién subida
           * para no dejar una carga incompleta/huérfana.
           */
          await supabase.storage
            .from("vehicle-images")
            .remove([
              imagePath,
            ]);

          throw new Error(
            `No se pudo subir el thumbnail: ${thumbnailUploadError.message}`,
          );
        }
      }

      const { error } = await supabase
        .from("vehicles")
        .insert({
          id: vehicleId,

          code: formData.code.trim().toUpperCase(),

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

          repair_reason: cleanOptionalText(
            formData.repair_reason,
          ),

          out_of_service_reason: cleanOptionalText(
            formData.out_of_service_reason,
          ),

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

          active: true,

          deactivation_date: null,
          deactivation_reason: null,

          /*
           * Si eligió foto, ya queda asociada EN EL ALTA.
           * No hacemos un UPDATE posterior.
           */
          image_path: imagePath,
          image_thumb_path:
            imageThumbPath,

          created_by: userId,
          updated_by: userId,
        });

      if (error) {
        /*
         * Si la foto ya se había subido pero falla el INSERT,
         * la eliminamos para no dejar un archivo huérfano.
         */
        const uploadedFiles = [
          imagePath,
          imageThumbPath,
        ].filter(
          (path): path is string =>
            Boolean(path),
        );

        if (
          uploadedFiles.length > 0
        ) {
          await supabase.storage
            .from("vehicle-images")
            .remove(
              uploadedFiles,
            );
        }

        if (error.code === "23505") {
          toast.error(
            "Ya existe un vehículo con ese código.",
          );

          return;
        }

        throw error;
      }

      toast.success(
        selectedImage
          ? "Vehículo, fotografía y thumbnail cargados correctamente"
          : "Vehículo cargado correctamente",
      );

      router.push(
        `/dashboard/planta-vehicular/${vehicleId}`,
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Error creando vehículo:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el vehículo",
      );
    } finally {
      setSaving(false);
    }
  };

  const showRepairReason =
    normalizeText(
      formData.operational_status,
    ).includes("reparacion") ||
    normalizeText(
      formData.operational_status,
    ).includes("arreglos");

  const showOutOfServiceReason =
    normalizeText(
      formData.operational_status,
    ).includes("fuera");

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          className="-ml-2 mb-4 gap-2"
          onClick={() =>
            router.push(
              "/dashboard/planta-vehicular",
            )
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Planta Vehicular
        </Button>

        <h1 className="text-3xl font-bold tracking-tight">
          Nuevo vehículo
        </h1>

        <p className="mt-2 text-muted-foreground">
          Cargá los datos del vehículo que se
          incorporará a Planta Vehicular.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* =====================================================
            FOTOGRAFÍA
        ====================================================== */}

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

            {imagePreviewUrl ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border bg-muted/20">
                  <img
                    src={imagePreviewUrl}
                    alt="Previsualización del vehículo"
                    className="h-[320px] w-full object-contain p-2"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      imageInputRef.current?.click()
                    }
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />

                    Cambiar fotografía
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={handleRemoveImage}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />

                    Quitar fotografía
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
                className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/10 p-6 text-center transition-colors hover:bg-muted/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="rounded-full border p-4">
                  <ImagePlus className="h-7 w-7 text-muted-foreground" />
                </div>

                <div>
                  <p className="font-medium">
                    Seleccionar fotografía
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    JPG, PNG o WEBP. Máximo 5 MB.
                  </p>
                </div>
              </button>
            )}

            <FieldHelp>
              La fotografía es opcional.
            </FieldHelp>
          </CardContent>
        </Card>

        {/* =====================================================
            IDENTIFICACIÓN
        ====================================================== */}

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
                  autoComplete="off"
                />

                <FieldHelp>
                  Identificador único del vehículo.
                  Ejemplo: S.P.8, P.C.2, B.6.
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
                  placeholder="Ej: Toyota Hilux 4x4 Doble Cab."
                  autoComplete="off"
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
                  placeholder="Ej: KHB108"
                  autoComplete="off"
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
                    new Date().getFullYear() +
                    1
                  }
                  value={formData.year}
                  onChange={(event) =>
                    handleChange(
                      "year",
                      event.target.value,
                    )
                  }
                  placeholder="Ej: 2011"
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

        {/* =====================================================
            ESTADO OPERATIVO
        ====================================================== */}

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
                    <SelectValue placeholder="Seleccionar condición" />
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
                    placeholder="Detalle de la reparación"
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
                    placeholder="Ej: Cumplió su ciclo"
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
                placeholder="Observaciones generales sobre el vehículo..."
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </FormField>
          </CardContent>
        </Card>

        {/* =====================================================
            EQUIPAMIENTO
        ====================================================== */}

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
                  placeholder="Ej: B1000041"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <BooleanField
                label="¿Posee ALLTRACK?"
                value={
                  formData.has_alltrack
                }
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
                value={
                  formData.has_camera
                }
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

        {/* =====================================================
            USO Y CHOFERES
        ====================================================== */}

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
                  placeholder="Ej: Director de Servicios Públicos"
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
                        setUseCustomSchedule(
                          true,
                        );

                        setCustomSchedule(
                          formData.schedule,
                        );

                        handleChange(
                          "schedule",
                          "",
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
                        Usá este campo solo si el horario no está entre
                        las opciones disponibles.
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

        {/* =====================================================
            ACCIONES
        ====================================================== */}

        <Card>
          <CardContent className="flex flex-col-reverse gap-3 py-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() =>
                router.push(
                  "/dashboard/planta-vehicular",
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
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar vehículo
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
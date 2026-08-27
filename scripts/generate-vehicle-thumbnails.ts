import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const BUCKET = "vehicle-images";

const THUMB_WIDTH = 640;
const THUMB_HEIGHT = 480;
const THUMB_QUALITY = 72;

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL en las variables de entorno.",
  );
}

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.",
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

/* =========================================================
   TYPES
========================================================= */

type VehicleRow = {
  id: string;
  code: string;
  vehicle: string;
  image_path: string | null;
  image_thumb_path: string | null;
};

type MigrationResult = {
  code: string;
  vehicle: string;
  status: "OK" | "SKIP" | "ERROR";
  originalBytes?: number;
  thumbnailBytes?: number;
  thumbnailPath?: string;
  message?: string;
};

/* =========================================================
   HELPERS
========================================================= */

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function comparable(value: unknown) {
  return JSON.stringify(value ?? null);
}

const HISTORY_IGNORED_KEYS =
  new Set([
    "updated_at",
    "updated_by",
  ]);

function changedKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);

  return [...keys].filter((key) => {
    if (
      HISTORY_IGNORED_KEYS.has(
        key,
      )
    ) {
      return false;
    }

    return (
      comparable(before[key]) !==
      comparable(after[key])
    );
  });
}

/* =========================================================
   LIMPIEZA DE EVENTO TÉCNICO DEL HISTORIAL
========================================================= */

/*
 * Actualizar image_thumb_path es una tarea técnica de migración,
 * no una edición real realizada por un usuario.
 *
 * Si tu trigger de vehicle_history registra el UPDATE, eliminamos
 * únicamente el evento recién creado cuando el único cambio real
 * fue image_thumb_path.
 */
async function removeSyntheticThumbnailHistory(
  vehicleId: string,
  startedAt: string,
) {
  const {
    data: events,
    error,
  } = await supabase
    .from("vehicle_history")
    .select(
      "id, event_type, metadata, created_at",
    )
    .eq(
      "vehicle_id",
      vehicleId,
    )
    .eq(
      "event_type",
      "updated",
    )
    .gte(
      "created_at",
      startedAt,
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(5);

  if (error) {
    console.warn(
      "  ⚠ No se pudo revisar vehicle_history:",
      error.message,
    );

    return;
  }

  for (const event of events || []) {
    const metadata =
      event.metadata as {
        before?: Record<
          string,
          unknown
        >;
        after?: Record<
          string,
          unknown
        >;
      } | null;

    const before =
      metadata?.before;

    const after =
      metadata?.after;

    if (!before || !after) {
      continue;
    }

    const keys =
      changedKeys(
        before,
        after,
      );

    if (
      keys.length === 1 &&
      keys[0] ===
        "image_thumb_path"
    ) {
      const {
        error: deleteError,
      } = await supabase
        .from("vehicle_history")
        .delete()
        .eq(
          "id",
          event.id,
        );

      if (deleteError) {
        console.warn(
          "  ⚠ No se pudo borrar el evento técnico del thumbnail:",
          deleteError.message,
        );
      } else {
        console.log(
          "  ↳ Evento técnico de thumbnail eliminado del historial.",
        );
      }

      return;
    }
  }
}

/* =========================================================
   GENERACIÓN DE UN THUMBNAIL
========================================================= */

async function generateOne(
  vehicle: VehicleRow,
  startedAt: string,
): Promise<MigrationResult> {
  if (!vehicle.image_path) {
    return {
      code: vehicle.code,
      vehicle: vehicle.vehicle,
      status: "SKIP",
      message: "Vehículo sin imagen original.",
    };
  }

  const expectedThumbPath =
    `${vehicle.id}/thumbnail.webp`;

  if (
    vehicle.image_thumb_path ===
      expectedThumbPath &&
    !force
  ) {
    return {
      code: vehicle.code,
      vehicle: vehicle.vehicle,
      status: "SKIP",
      thumbnailPath:
        expectedThumbPath,
      message:
        "Ya tiene thumbnail. Usá --force para regenerarlo.",
    };
  }

  console.log(
    `  ↓ Descargando original: ${vehicle.image_path}`,
  );

  const {
    data: originalBlob,
    error: downloadError,
  } = await supabase.storage
    .from(BUCKET)
    .download(
      vehicle.image_path,
    );

  if (downloadError) {
    throw new Error(
      `No se pudo descargar la imagen original: ${downloadError.message}`,
    );
  }

  const originalBuffer =
    Buffer.from(
      await originalBlob.arrayBuffer(),
    );

  if (
    originalBuffer.byteLength === 0
  ) {
    throw new Error(
      "La imagen original está vacía.",
    );
  }

  console.log(
    `  🖼 Original: ${formatBytes(originalBuffer.byteLength)}`,
  );

  /*
   * rotate() respeta la orientación EXIF antes de redimensionar.
   *
   * 640x480 coincide con el 4:3 usado en las cards.
   * fit: "cover" evita bandas vacías y genera una imagen lista
   * para la grilla.
   */
  const thumbnailBuffer =
    await sharp(originalBuffer)
      .rotate()
      .resize({
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        fit: "cover",
        position: "centre",
        withoutEnlargement: true,
      })
      .webp({
        quality: THUMB_QUALITY,
        effort: 4,
      })
      .toBuffer();

  console.log(
    `  ⚡ Thumbnail: ${formatBytes(thumbnailBuffer.byteLength)}`,
  );

  const savings =
    originalBuffer.byteLength > 0
      ? (
          100 -
          (thumbnailBuffer.byteLength /
            originalBuffer.byteLength) *
            100
        ).toFixed(1)
      : "0";

  console.log(
    `  ↳ Reducción aproximada: ${savings}%`,
  );

  if (dryRun) {
    return {
      code: vehicle.code,
      vehicle: vehicle.vehicle,
      status: "SKIP",
      originalBytes:
        originalBuffer.byteLength,
      thumbnailBytes:
        thumbnailBuffer.byteLength,
      thumbnailPath:
        expectedThumbPath,
      message:
        "DRY RUN: thumbnail generado en memoria, sin modificar Supabase.",
    };
  }

  const {
    error: uploadError,
  } = await supabase.storage
    .from(BUCKET)
    .upload(
      expectedThumbPath,
      thumbnailBuffer,
      {
        contentType:
          "image/webp",
        cacheControl:
          "31536000",
        upsert: true,
      },
    );

  if (uploadError) {
    throw new Error(
      `No se pudo subir el thumbnail: ${uploadError.message}`,
    );
  }

  console.log(
    `  ↑ Storage: ${expectedThumbPath}`,
  );

  const {
    data: updatedVehicle,
    error: updateError,
  } = await supabase
    .from("vehicles")
    .update({
      image_thumb_path:
        expectedThumbPath,
    })
    .eq(
      "id",
      vehicle.id,
    )
    .select(
      "id, image_thumb_path",
    )
    .maybeSingle();

  if (
    updateError ||
    !updatedVehicle
  ) {
    /*
     * Si recién creamos el thumbnail y falla el UPDATE,
     * evitamos dejar el archivo huérfano.
     */
    if (!vehicle.image_thumb_path) {
      await supabase.storage
        .from(BUCKET)
        .remove([
          expectedThumbPath,
        ]);
    }

    throw new Error(
      updateError
        ? `No se pudo actualizar image_thumb_path: ${updateError.message}`
        : "Supabase no actualizó image_thumb_path.",
    );
  }

  await removeSyntheticThumbnailHistory(
    vehicle.id,
    startedAt,
  );

  return {
    code: vehicle.code,
    vehicle: vehicle.vehicle,
    status: "OK",
    originalBytes:
      originalBuffer.byteLength,
    thumbnailBytes:
      thumbnailBuffer.byteLength,
    thumbnailPath:
      expectedThumbPath,
    message: `${formatBytes(originalBuffer.byteLength)} → ${formatBytes(
      thumbnailBuffer.byteLength,
    )}`,
  };
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  console.log("");
  console.log(
    "==================================================",
  );
  console.log(
    " THUMBNAILS - PLANTA VEHICULAR",
  );
  console.log(
    "==================================================",
  );
  console.log(
    `Bucket:    ${BUCKET}`,
  );
  console.log(
    `Tamaño:    ${THUMB_WIDTH}x${THUMB_HEIGHT}`,
  );
  console.log(
    `Formato:   WEBP calidad ${THUMB_QUALITY}`,
  );
  console.log(
    `Modo:      ${
      dryRun
        ? "DRY RUN"
        : "GENERACIÓN REAL"
    }`,
  );
  console.log(
    `Forzar:    ${
      force ? "Sí" : "No"
    }`,
  );
  console.log("");

  const {
    data,
    error,
  } = await supabase
    .from("vehicles")
    .select(
      "id, code, vehicle, image_path, image_thumb_path",
    )
    .not(
      "image_path",
      "is",
      null,
    )
    .order(
      "code",
      {
        ascending: true,
      },
    );

  if (error) {
    throw new Error(
      `No se pudieron obtener los vehículos: ${error.message}`,
    );
  }

  const vehicles =
    (data || []) as VehicleRow[];

  console.log(
    `Vehículos con imagen original: ${vehicles.length}`,
  );
  console.log("");

  const results:
    MigrationResult[] = [];

  const startedAt =
    new Date(
      Date.now() - 10_000,
    ).toISOString();

  for (
    let index = 0;
    index < vehicles.length;
    index += 1
  ) {
    const vehicle =
      vehicles[index];

    console.log(
      `[${index + 1}/${vehicles.length}] ${vehicle.code} - ${vehicle.vehicle}`,
    );

    try {
      const result =
        await generateOne(
          vehicle,
          startedAt,
        );

      results.push(
        result,
      );

      if (
        result.status === "OK"
      ) {
        console.log(
          `  ✅ OK`,
        );
      } else {
        console.log(
          `  ℹ ${result.message}`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      results.push({
        code: vehicle.code,
        vehicle:
          vehicle.vehicle,
        status: "ERROR",
        message,
      });

      console.error(
        `  ❌ ${message}`,
      );
    }

    console.log("");
  }

  const ok =
    results.filter(
      (result) =>
        result.status === "OK",
    );

  const skipped =
    results.filter(
      (result) =>
        result.status === "SKIP",
    );

  const errors =
    results.filter(
      (result) =>
        result.status === "ERROR",
    );

  const originalBytes =
    results.reduce(
      (sum, result) =>
        sum +
        (result.originalBytes ||
          0),
      0,
    );

  const thumbnailBytes =
    results.reduce(
      (sum, result) =>
        sum +
        (result.thumbnailBytes ||
          0),
      0,
    );

  console.log(
    "==================================================",
  );
  console.log(
    " RESULTADO",
  );
  console.log(
    "==================================================",
  );
  console.log(
    `Generados: ${ok.length}`,
  );
  console.log(
    `Omitidos:  ${skipped.length}`,
  );
  console.log(
    `Errores:   ${errors.length}`,
  );

  if (
    originalBytes > 0 &&
    thumbnailBytes > 0
  ) {
    console.log("");
    console.log(
      `Originales procesados: ${formatBytes(originalBytes)}`,
    );
    console.log(
      `Thumbnails generados:  ${formatBytes(thumbnailBytes)}`,
    );
    console.log(
      `Reducción total aprox: ${
        (
          100 -
          (thumbnailBytes /
            originalBytes) *
            100
        ).toFixed(1)
      }%`,
    );
  }

  if (errors.length > 0) {
    console.log("");
    console.log(
      "Vehículos con error:",
    );

    console.table(
      errors.map(
        (result) => ({
          codigo:
            result.code,
          vehiculo:
            result.vehicle,
          error:
            result.message,
        }),
      ),
    );

    process.exitCode = 1;
  } else {
    console.log("");
    console.log(
      dryRun
        ? "✅ DRY RUN finalizado."
        : "✅ Thumbnails generados correctamente.",
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "❌ Error fatal:",
    error,
  );

  process.exit(1);
});

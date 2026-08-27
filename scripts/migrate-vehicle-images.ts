import { readFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const BUCKET = "vehicle-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const manifestPath =
  process.argv.find((arg) => arg.startsWith("--manifest="))
    ?.split("=")
    .slice(1)
    .join("=") ||
  path.resolve(
    process.cwd(),
    "manifest_fotos_planta_vehicular.csv",
  );

const dryRun = process.argv.includes("--dry-run");

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

type ManifestRow = {
  id: string;
  code: string;
  vehicle: string;
  drive_photo_url: string;
};

type MigrationResult = {
  code: string;
  vehicle: string;
  status: "OK" | "SKIP" | "ERROR";
  imagePath?: string;
  message?: string;
};

/* =========================================================
   CSV
========================================================= */

function parseCsvLine(line: string) {
  const values: string[] = [];

  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);

  return values.map((value) =>
    value.trim(),
  );
}

function parseManifest(csv: string): ManifestRow[] {
  const cleanCsv = csv.replace(/^\uFEFF/, "");

  const lines = cleanCsv
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  const required = [
    "id",
    "code",
    "vehicle",
    "drive_photo_url",
  ];

  for (const field of required) {
    if (!headers.includes(field)) {
      throw new Error(
        `El manifiesto no contiene la columna requerida: ${field}`,
      );
    }
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);

    const row = Object.fromEntries(
      headers.map((header, index) => [
        header,
        values[index] ?? "",
      ]),
    ) as ManifestRow;

    return row;
  });
}

/* =========================================================
   GOOGLE DRIVE
========================================================= */

function extractGoogleDriveFileId(url: string) {
  const patterns = [
    /\/file\/d\/([^/]+)/i,
    /[?&]id=([^&]+)/i,
    /\/d\/([^/]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function getDirectGoogleDriveUrl(
  originalUrl: string,
) {
  const fileId =
    extractGoogleDriveFileId(
      originalUrl,
    );

  if (!fileId) {
    throw new Error(
      `No pude extraer el ID de Google Drive: ${originalUrl}`,
    );
  }

  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
    fileId,
  )}&export=download&confirm=t`;
}

function extensionFromMime(
  mimeType: string,
) {
  const cleanMime =
    mimeType
      .split(";")[0]
      .trim()
      .toLowerCase();

  switch (cleanMime) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    default:
      return null;
  }
}

async function downloadImage(
  driveUrl: string,
) {
  const directUrl =
    getDirectGoogleDriveUrl(
      driveUrl,
    );

  const response = await fetch(
    directUrl,
    {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 VehicleMigration/1.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Drive respondió HTTP ${response.status}`,
    );
  }

  const contentType =
    response.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase() || "";

  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
    ].includes(contentType)
  ) {
    throw new Error(
      `Drive no devolvió una imagen válida. Content-Type recibido: ${
        contentType || "desconocido"
      }. Revisá que el archivo tenga acceso "Cualquier persona con el enlace".`,
    );
  }

  const extension =
    extensionFromMime(
      contentType,
    );

  if (!extension) {
    throw new Error(
      `Tipo de imagen no admitido: ${contentType}`,
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new Error(
      "La imagen descargada está vacía.",
    );
  }

  if (
    arrayBuffer.byteLength >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      `La imagen pesa ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(
        2,
      )} MB y supera el límite de 5 MB.`,
    );
  }

  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: contentType,
    extension,
    size: arrayBuffer.byteLength,
  };
}

/* =========================================================
   HISTORIAL
========================================================= */

/*
 * Como los 117 vehículos ya fueron insertados antes de migrar
 * las fotos, actualizar image_path dispara el trigger del historial.
 *
 * Ese evento sería puramente técnico:
 *
 *   Imagen: Sin dato -> <uuid>/principal.jpg
 *
 * y NO representa una edición real del vehículo.
 *
 * Por eso, luego del UPDATE, eliminamos solamente el evento
 * recién generado SI el único cambio real fue image_path.
 *
 * Ignoramos updated_at y updated_by al comparar porque son
 * campos técnicos.
 */

const HISTORY_IGNORED_KEYS =
  new Set([
    "updated_at",
    "updated_by",
  ]);

function comparable(value: unknown) {
  return JSON.stringify(
    value ?? null,
  );
}

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

async function removeSyntheticImageHistory(
  vehicleId: string,
  migrationStartedAt: string,
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
      migrationStartedAt,
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(5);

  if (error) {
    console.warn(
      "  ⚠ No se pudo revisar el historial técnico:",
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
      keys[0] === "image_path"
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
          "  ⚠ No se pudo borrar el evento técnico de imagen:",
          deleteError.message,
        );
      } else {
        console.log(
          "  ↳ Historial técnico de imagen eliminado.",
        );
      }

      return;
    }
  }
}

/* =========================================================
   MIGRACIÓN DE UNA FOTO
========================================================= */

async function migrateOne(
  row: ManifestRow,
  migrationStartedAt: string,
): Promise<MigrationResult> {
  const {
    data: vehicle,
    error: vehicleError,
  } = await supabase
    .from("vehicles")
    .select(
      "id, code, vehicle, image_path",
    )
    .eq(
      "id",
      row.id,
    )
    .maybeSingle();

  if (vehicleError) {
    throw new Error(
      `Error verificando vehicles: ${vehicleError.message}`,
    );
  }

  if (!vehicle) {
    throw new Error(
      `No existe vehicles.id=${row.id}`,
    );
  }

  if (
    vehicle.code
      .trim()
      .toUpperCase() !==
    row.code
      .trim()
      .toUpperCase()
  ) {
    throw new Error(
      `El UUID existe pero corresponde a ${vehicle.code}, no a ${row.code}.`,
    );
  }

  if (dryRun) {
    const directUrl =
      getDirectGoogleDriveUrl(
        row.drive_photo_url,
      );

    return {
      code: row.code,
      vehicle: row.vehicle,
      status: "SKIP",
      message: `DRY RUN OK - ${directUrl}`,
    };
  }

  console.log(
    `  ↓ Descargando fotografía de Drive...`,
  );

  const image =
    await downloadImage(
      row.drive_photo_url,
    );

  console.log(
    `  ↓ Imagen descargada: ${(image.size / 1024).toFixed(
      1,
    )} KB (${image.mimeType})`,
  );

  const imagePath =
    `${row.id}/principal.${image.extension}`;

  /*
   * Si por una ejecución anterior quedó otro principal con
   * una extensión diferente, lo eliminaremos después de que
   * la nueva imagen esté correctamente asociada.
   */
  const previousPath =
    vehicle.image_path;

  const {
    error: uploadError,
  } = await supabase.storage
    .from(BUCKET)
    .upload(
      imagePath,
      image.bytes,
      {
        contentType:
          image.mimeType,
        cacheControl:
          "3600",
        upsert: true,
      },
    );

  if (uploadError) {
    throw new Error(
      `Error subiendo a Storage: ${uploadError.message}`,
    );
  }

  console.log(
    `  ↑ Storage: ${imagePath}`,
  );

  const {
    data: updatedVehicle,
    error: updateError,
  } = await supabase
    .from("vehicles")
    .update({
      image_path:
        imagePath,
    })
    .eq(
      "id",
      row.id,
    )
    .select("id, image_path")
    .maybeSingle();

  if (
    updateError ||
    !updatedVehicle
  ) {
    /*
     * No dejamos archivo huérfano si el UPDATE falló.
     */
    await supabase.storage
      .from(BUCKET)
      .remove([
        imagePath,
      ]);

    throw new Error(
      updateError
        ? `Error actualizando image_path: ${updateError.message}`
        : "Supabase no actualizó image_path.",
    );
  }

  /*
   * Quitamos únicamente el evento técnico generado
   * por este UPDATE de image_path.
   */
  await removeSyntheticImageHistory(
    row.id,
    migrationStartedAt,
  );

  /*
   * Si había una ruta anterior distinta, recién ahora,
   * con la nueva ya asociada correctamente, la eliminamos.
   */
  if (
    previousPath &&
    previousPath !== imagePath
  ) {
    const {
      error: oldRemoveError,
    } = await supabase.storage
      .from(BUCKET)
      .remove([
        previousPath,
      ]);

    if (oldRemoveError) {
      console.warn(
        `  ⚠ No se pudo limpiar la imagen anterior ${previousPath}:`,
        oldRemoveError.message,
      );
    }
  }

  return {
    code: row.code,
    vehicle: row.vehicle,
    status: "OK",
    imagePath,
    message: `${(image.size / 1024).toFixed(
      1,
    )} KB`,
  };
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  console.log("");
  console.log(
    "==============================================",
  );
  console.log(
    " MIGRACIÓN DE FOTOS - PLANTA VEHICULAR",
  );
  console.log(
    "==============================================",
  );
  console.log(
    `Manifest: ${manifestPath}`,
  );
  console.log(
    `Bucket:   ${BUCKET}`,
  );
  console.log(
    `Modo:     ${
      dryRun
        ? "DRY RUN (no modifica nada)"
        : "MIGRACIÓN REAL"
    }`,
  );
  console.log("");

  const csv =
    await readFile(
      manifestPath,
      "utf8",
    );

  const rows =
    parseManifest(csv);

  if (rows.length === 0) {
    throw new Error(
      "El manifiesto no contiene fotos para migrar.",
    );
  }

  console.log(
    `Fotos encontradas en el manifiesto: ${rows.length}`,
  );
  console.log("");

  const migrationStartedAt =
    new Date(
      Date.now() - 10_000,
    ).toISOString();

  const results:
    MigrationResult[] = [];

  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index];

    console.log(
      `[${index + 1}/${rows.length}] ${row.code} - ${row.vehicle}`,
    );

    try {
      const result =
        await migrateOne(
          row,
          migrationStartedAt,
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
        code: row.code,
        vehicle:
          row.vehicle,
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
      (item) =>
        item.status === "OK",
    ).length;

  const skipped =
    results.filter(
      (item) =>
        item.status === "SKIP",
    ).length;

  const errors =
    results.filter(
      (item) =>
        item.status === "ERROR",
    );

  console.log(
    "==============================================",
  );
  console.log(
    " RESULTADO",
  );
  console.log(
    "==============================================",
  );
  console.log(
    `Correctas: ${ok}`,
  );
  console.log(
    `Dry-run:   ${skipped}`,
  );
  console.log(
    `Errores:   ${errors.length}`,
  );

  if (errors.length > 0) {
    console.log("");
    console.log(
      "Vehículos con error:",
    );

    console.table(
      errors.map(
        (item) => ({
          codigo:
            item.code,
          vehiculo:
            item.vehicle,
          error:
            item.message,
        }),
      ),
    );

    process.exitCode = 1;
  } else {
    console.log("");
    console.log(
      "✅ Migración finalizada sin errores.",
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "❌ Error fatal en la migración:",
    error,
  );

  process.exit(1);
});

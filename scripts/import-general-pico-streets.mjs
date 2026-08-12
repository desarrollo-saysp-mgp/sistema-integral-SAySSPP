import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const projectRoot = path.resolve(currentDirectory, "..");

dotenv.config({
  path: path.join(projectRoot, ".env.import"),
});

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.import"
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const geojsonPath = path.join(
  projectRoot,
  "scripts",
  "data",
  "general-pico-streets.geojson"
);

function parseOsmIdentifier(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^(node|way|relation)\/(\d+)$/);

  if (!match) return null;

  return {
    osmType: match[1],
    osmId: Number(match[2]),
  };
}

async function main() {
  const rawFile = await fs.readFile(geojsonPath, "utf8");
  const geojson = JSON.parse(rawFile);

  if (
    geojson.type !== "FeatureCollection" ||
    !Array.isArray(geojson.features)
  ) {
    throw new Error("El archivo no es un GeoJSON válido");
  }

  const validFeatures = geojson.features.filter((feature) => {
    return (
      feature?.type === "Feature" &&
      feature?.geometry?.type === "LineString" &&
      typeof feature?.properties?.name === "string" &&
      feature.properties.name.trim() !== ""
    );
  });

  console.log(`Elementos totales: ${geojson.features.length}`);
  console.log(`Calles válidas: ${validFeatures.length}`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, feature] of validFeatures.entries()) {
    const identifier = parseOsmIdentifier(feature.properties["@id"]);

    if (!identifier || identifier.osmType !== "way") {
      skipped++;
      continue;
    }

    const { error } = await supabase.rpc("test_insert_city_street", {
      p_osm_id: identifier.osmId,
      p_osm_type: identifier.osmType,
      p_name: feature.properties.name.trim(),
      p_highway_type:
        typeof feature.properties.highway === "string"
          ? feature.properties.highway
          : null,
      p_geometry: feature.geometry,
    });

    if (error) {
      failed++;
      console.error(
        `Error en ${feature.properties.name}: ${error.message}`
      );
      continue;
    }

    imported++;

    if ((index + 1) % 100 === 0) {
      console.log(
        `Procesadas ${index + 1}/${validFeatures.length} - importadas ${imported}`
      );
    }
  }

  console.log("");
  console.log("Importación terminada");
  console.log(`Importadas: ${imported}`);
  console.log(`Omitidas: ${skipped}`);
  console.log(`Errores: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
import { getAlerts } from "@/lib/get-alerts";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = await getAlerts();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generando alertas:", error);

    return NextResponse.json(
      {
        error: "Error al generar alertas",
      },
      { status: 500 }
    );
  }
}
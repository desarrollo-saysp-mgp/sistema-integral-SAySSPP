"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Por favor ingresa un email válido");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password/confirm`,
        },
      );

      if (resetError) {
        setError(
          "Error al enviar el email de recuperación. Intenta nuevamente.",
        );
        console.error("Password reset error:", resetError);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError("Error inesperado. Por favor intenta nuevamente.");
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              Email Enviado
            </CardTitle>
            <CardDescription className="text-center">
              Revisa tu bandeja de entrada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">
                Hemos enviado un enlace de recuperación a{" "}
                <strong>{email}</strong>. Por favor revisa tu email y sigue las
                instrucciones para restablecer tu contraseña.
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Si no recibes el email en unos minutos, revisa tu carpeta de spam.
            </p>
            <div className="flex justify-center pt-4">
              <Link href="/login">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            Recuperar Contraseña
          </CardTitle>
          <CardDescription className="text-center">
            Ingresa tu email para recibir un enlace de recuperación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu-email@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar enlace de recuperación"}
            </Button>

            <div className="flex justify-center pt-4">
              <Link href="/login">
                <Button variant="link" className="text-sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

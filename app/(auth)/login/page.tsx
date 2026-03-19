"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error("Error de autenticación: " + error.message);
        return;
      }

      if (data.user) {
        toast.success("Inicio de sesión exitoso");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Error inesperado al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f5f5]">
      <div className="relative grid min-h-screen lg:grid-cols-[1.2fr_0.8fr]">
        {/* Panel izquierdo */}
        <section className="relative hidden min-h-screen overflow-hidden lg:block bg-transparent">
          <div className="absolute inset-0">
            <Image
              src="/login-visual.png"
              alt="Identidad visual General Pico"
              fill
              priority
              className="object-cover object-left-bottom"
            />
          </div>
        </section>

        {/* Panel derecho */}
        <section className="absolute inset-0 flex items-center justify-center lg:justify-start lg:pl-[52%]">
          <div className="w-full max-w-[520px]">
            <Card className="rounded-3xl border border-white/60 bg-white shadow-[0_40px_120px_rgba(0,0,0,0.25)] backdrop-blur-sm">
              <CardHeader className="space-y-3 px-8 pt-10 text-center sm:px-10">
                <CardTitle className="text-4xl font-bold text-[#373737]">
                  Sistema Integral SAySSPP
                </CardTitle>

                <CardDescription className="text-base text-slate-500">
                  Ingresá tus credenciales para continuar
                </CardDescription>
              </CardHeader>

              <CardContent className="px-8 pb-10 sm:px-10">
                <form onSubmit={handleSignIn} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[15px] font-medium text-[#373737]">
                      Correo electrónico
                    </Label>

                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-14 rounded-xl border-slate-200 px-4 text-base focus-visible:ring-2 focus-visible:ring-[#00A27F] focus-visible:ring-offset-0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[15px] font-medium text-[#373737]">
                      Contraseña
                    </Label>

                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="h-14 rounded-xl border-slate-200 px-4 text-base focus-visible:ring-2 focus-visible:ring-[#00A27F] focus-visible:ring-offset-0"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-14 w-full rounded-xl bg-[#00A27F] text-lg font-semibold text-white transition hover:bg-[#008568]"
                  >
                    {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
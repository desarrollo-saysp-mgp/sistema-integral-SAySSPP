"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, FilePlus2, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";

type NavigationIcon = "nueva" | "mapa" | "estadisticas";

type Props = {
  href: string;
  label: string;
  icon: NavigationIcon;
};

const icons = {
  nueva: FilePlus2,
  mapa: MapPinned,
  estadisticas: BarChart3,
};

/** Mismo modal de navegación utilizado en el Dashboard de Reclamos. */
export function InterventionNavigationButton({ href, label, icon }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const Icon = icons[icon];

  const navigate = () => {
    if (isPending) return;
    startTransition(() => router.push(href));
  };

  return (
    <>
      {isPending && <PageLoader show={true} />}
      <Button
        type="button"
        onClick={navigate}
        disabled={isPending}
        aria-busy={isPending}
        className="h-11 w-full rounded-lg bg-[#00A27F] text-sm font-semibold hover:bg-[#008C70] disabled:opacity-75 sm:text-base"
      >
        <Icon className="mr-2 h-4 w-4" />
        {label}
      </Button>
    </>
  );
}

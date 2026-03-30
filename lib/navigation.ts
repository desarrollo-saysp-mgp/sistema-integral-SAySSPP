export type AppModule =
  | "complaints"
  | "purchase_requests"
  | "rrhh"
  | "supplies"
  | "workshop"
  | "public_services"
  | "girsu"
  | "apu"
  | "zv"
  | "shelter";

type ModuleConfig = {
  key: AppModule;
  label: string;
  shortLabel: string;
  basePath: string;
  homePath: string;
  subtitle: string;
};

export const MODULES: Record<AppModule, ModuleConfig> = {
  complaints: {
    key: "complaints",
    label: "Reclamos",
    shortLabel: "Reclamos",
    basePath: "/dashboard/complaints",
    homePath: "/dashboard/complaints/home",
    subtitle: "Gestión de Reclamos",
  },
  purchase_requests: {
    key: "purchase_requests",
    label: "Solicitud de Compra",
    shortLabel: "Compras",
    basePath: "/dashboard/solicitud-compra",
    homePath: "/dashboard/solicitud-compra",
    subtitle: "Módulo de Solicitud de Compra",
  },
  rrhh: {
    key: "rrhh",
    label: "Recursos Humanos",
    shortLabel: "RRHH",
    basePath: "/dashboard/rrhh",
    homePath: "/dashboard/rrhh",
    subtitle: "Módulo de Recursos Humanos",
  },
  supplies: {
    key: "supplies",
    label: "Suministros",
    shortLabel: "Suministros",
    basePath: "/dashboard/suministros",
    homePath: "/dashboard/suministros",
    subtitle: "Módulo de Suministros",
  },
  workshop: {
    key: "workshop",
    label: "Mantenimiento Taller",
    shortLabel: "Taller",
    basePath: "/dashboard/mantenimiento-taller",
    homePath: "/dashboard/mantenimiento-taller",
    subtitle: "Módulo de Mantenimiento Taller",
  },
  public_services: {
    key: "public_services",
    label: "Servicios Públicos",
    shortLabel: "Servicios Públicos",
    basePath: "/dashboard/servicios-publicos",
    homePath: "/dashboard/servicios-publicos",
    subtitle: "Módulo de Servicios Públicos",
  },
  girsu: {
    key: "girsu",
    label: "GIRSU",
    shortLabel: "GIRSU",
    basePath: "/dashboard/girsu",
    homePath: "/dashboard/girsu",
    subtitle: "Módulo de GIRSU",
  },
  apu: {
    key: "apu",
    label: "Arbolado / APU",
    shortLabel: "APU",
    basePath: "/dashboard/apu",
    homePath: "/dashboard/apu",
    subtitle: "Módulo de Arbolado / APU",
  },
  zv: {
    key: "zv",
    label: "ZV",
    shortLabel: "ZV",
    basePath: "/dashboard/zv",
    homePath: "/dashboard/zv",
    subtitle: "Módulo de ZV",
  },
  shelter: {
    key: "shelter",
    label: "Refugio",
    shortLabel: "Refugio",
    basePath: "/dashboard/refugio",
    homePath: "/dashboard/refugio",
    subtitle: "Módulo de Refugio",
  },
};

export function getCurrentModule(pathname?: string | null): AppModule | null {
  if (!pathname) return null;

  const module = Object.values(MODULES).find((item) =>
    pathname.startsWith(item.basePath),
  );

  return module?.key ?? null;
}

export function isAccessesPage(pathname?: string | null) {
  return !!pathname?.startsWith("/dashboard/accesos");
}

export function isAdminPage(pathname?: string | null) {
  return !!pathname?.startsWith("/admin");
}

export function getNavbarContext(pathname?: string | null) {
  if (!pathname) {
    return {
      title: "Sistema Integral SAySSPP",
      subtitle: "Acceso a módulos del sistema",
    };
  }

  if (isAccessesPage(pathname)) {
    return {
      title: "Sistema Integral SAySSPP",
      subtitle: "Acceso a módulos del sistema",
    };
  }

  if (pathname.startsWith("/admin/users")) {
    return {
      title: "Sistema Integral SAySSPP",
      subtitle: "Administración de usuarios",
    };
  }

  if (pathname.startsWith("/admin/services")) {
    return {
      title: "Sistema Integral SAySSPP",
      subtitle: "Configuración de servicios",
    };
  }

  const currentModule = getCurrentModule(pathname);

  if (currentModule) {
    const module = MODULES[currentModule];

    if (pathname === module.homePath) {
      return {
        title: "Sistema Integral SAySSPP",
        subtitle: `Panel principal de ${module.label}`,
      };
    }

    return {
      title: "Sistema Integral SAySSPP",
      subtitle: module.subtitle,
    };
  }

  return {
    title: "Sistema Integral SAySSPP",
    subtitle: "Acceso a módulos del sistema",
  };
}
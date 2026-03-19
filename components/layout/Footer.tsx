export function Footer() {
  return (
    <footer className="w-full bg-[#00A27F]/5">
      
      {/* LÍNEA VERDE SUPERIOR */}
      <div className="h-[3px] w-full bg-[#00A27F]" />

      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        
        {/* IZQUIERDA - LOGO */}
        <div className="flex items-center gap-3">
          <img
            src="/logo-general-pico-horizontal.png"
            alt="General Pico"
            className="h-7 object-contain opacity-90"
          />
        </div>

        {/* DERECHA - TEXTO */}
        <div className="flex items-center gap-3 text-xs tracking-wide">
          
          <div className="h-5 w-[2px] bg-[#00A27F]" />

          <div className="text-[#00A27F] font-medium whitespace-nowrap">
            Secretaría de Ambiente y Servicios Públicos
          </div>

          <div className="text-muted-foreground hidden sm:block whitespace-nowrap">
            Municipalidad de General Pico
          </div>
        </div>
      </div>
    </footer>
  );
}
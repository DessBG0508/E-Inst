import { useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Info,
  Phone,
  PhoneCall,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmergencyContactCard {
  id: string;
  name: string;
  number: string;
  schedule: string;
  telHref: string;
  icon: typeof PhoneCall;
}

const EMERGENCY_CONTACTS: EmergencyContactCard[] = [
  {
    id: "saptel",
    name: "SAPTEL",
    number: "800 472 7835",
    schedule: "24 horas, todos los días",
    telHref: "tel:8004727835",
    icon: PhoneCall,
  },
  {
    id: "emergencias",
    name: "Emergencias",
    number: "911",
    schedule: "24 horas",
    telHref: "tel:911",
    icon: ShieldAlert,
  },
  {
    id: "tesh",
    name: "TESH",
    number: "55 5829 0000 Ext. 109",
    schedule: "L-V 9:00-17:00",
    telHref: "tel:5558290000",
    icon: Building2,
  },
];

export function AlertaPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const handleCallMainLine = () => {
    window.location.href = "tel:8009112000";
  };

  const handleCallService = (telHref: string) => {
    window.location.href = telHref;
  };

  return (
    <div className="min-h-screen w-full bg-[#FEE2E2] px-4 py-6 font-sans text-[#1A1A1A] transition-colors dark:bg-[#1E0B0E] dark:text-[#F5F1E8] sm:px-6 sm:py-8">
      {/* Botón Volver en esquina superior izquierda */}
      <div className="mx-auto mb-6 max-w-5xl">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
              return;
            }
            navigate({ to: "/chat" });
          }}
          className="h-9 cursor-pointer gap-2 rounded-md px-3 text-sm font-semibold text-[#1F4D2C] hover:bg-[#1F4D2C]/10 hover:text-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:text-[#8FC9B5] dark:hover:bg-[#8FC9B5]/10 dark:hover:text-[#8FC9B5]"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          <span>Volver</span>
        </Button>
      </div>

      {/* Card central */}
      <main className="mx-auto flex max-w-2xl flex-col items-center">
        <motion.section
          aria-labelledby="alerta-crisis-title"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full rounded-lg border-2 border-[#C8102E] bg-white p-6 shadow-sm dark:bg-[#1A2618] sm:p-8"
        >
          {/* Encabezado */}
          <header className="flex flex-col items-center text-center">
            <AlertTriangle
              className="size-12 text-[#C8102E] dark:text-[#F87171]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <h1
              id="alerta-crisis-title"
              className="mt-4 font-sans text-3xl font-bold tracking-tight text-[#C8102E] dark:text-[#F87171]"
            >
              Necesitas ayuda ahora
            </h1>
            <p className="mt-2 font-sans text-base font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
              No estás solo. Estas líneas están disponibles 24/7.
            </p>
          </header>

          {/* CTA Principal Hero */}
          <div className="mt-7">
            <Button
              type="button"
              onClick={handleCallMainLine}
              className="h-auto min-h-14 w-full cursor-pointer gap-2.5 whitespace-normal rounded-lg bg-[#C8102E] px-4 py-3 text-center text-base font-bold leading-snug text-white transition-colors hover:bg-[#9B0C24] focus-visible:ring-2 focus-visible:ring-[#C8102E] focus-visible:ring-offset-2 sm:text-lg"
            >
              <Phone className="size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span>Llamar ahora a Línea de la Vida — 800 911 2000</span>
            </Button>
          </div>

          {/* Grid de contactos (3 columnas en desktop, 1 en móvil) */}
          <div
            className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3"
            aria-label="Contactos de apoyo y emergencias"
          >
            {EMERGENCY_CONTACTS.map((contact) => {
              const Icon = contact.icon;
              return (
                <article
                  key={contact.id}
                  className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                >
                  <div>
                    <Icon
                      className="size-8 text-[#1F4D2C] dark:text-[#8FC9B5]"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <h2 className="mt-3 text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      {contact.name}
                    </h2>
                    <p className="mt-1 font-sans text-lg font-bold leading-snug text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                      {contact.number}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                      {contact.schedule}
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleCallService(contact.telHref)}
                    className="mt-4 h-10 w-full cursor-pointer gap-1.5 rounded-md bg-[#1F4D2C] text-sm font-semibold text-white transition-colors hover:bg-[#4A7C59] focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
                  >
                    <Phone className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Llamar</span>
                  </Button>
                </article>
              );
            })}
          </div>

          {/* Aviso inferior */}
          <aside
            aria-label="Aviso clínico importante"
            className="mt-6 flex items-start gap-3 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
          >
            <Info
              className="mt-0.5 size-5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <p className="font-sans text-sm font-medium leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
              Este tamizaje no constituye un diagnóstico clínico. Si tu vida o la de alguien más
              está en riesgo inmediato, marca{" "}
              <span className="font-bold text-[#C8102E] dark:text-[#F87171]">911</span> ahora.
            </p>
          </aside>
        </motion.section>
      </main>
    </div>
  );
}

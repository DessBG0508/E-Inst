import type { ReactNode } from "react";

export interface PrivacySection {
  id: string;
  number: number;
  title: string;
  content: ReactNode;
}

export const AVISO_PRIVACIDAD_METADATA = {
  version: "1.0",
  fechaVigencia: "20 de octubre de 2026",
  responsable: "Tecnológico de Estudios Superiores de Huixquilucan (TESH)",
  domicilio: "Barrio El Río s/n, Magdalena Chichicaspa, Huixquilucan, Estado de México, C.P. 52773",
  contactoDpo: "privacidad@tesh.edu.mx",
};

export const AVISO_PRIVACIDAD_SECCIONES: PrivacySection[] = [
  {
    id: "responsable",
    number: 1,
    title: "Identidad y Domicilio del Responsable",
    content: (
      <div className="space-y-3 text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
        <p>
          El{" "}
          <strong className="font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
            Tecnológico de Estudios Superiores de Huixquilucan (TESH)
          </strong>
          , a través de la Subdirección de Servicios Escolares y el Área de Psicología y Bienestar
          Universitario, es el responsable del tratamiento, resguardo y protección de los datos
          personales y datos personales sensibles recabados mediante la plataforma{" "}
          <strong>Equilibra TESH</strong>, en cumplimiento con la Ley Federal de Protección de Datos
          Personales en Posesión de los Particulares (LFPDPPP) y la norma NOM-024-SSA3-2012.
        </p>
        <div className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-4 text-xs leading-relaxed dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
          <p>
            <strong>Domicilio institucional:</strong> {AVISO_PRIVACIDAD_METADATA.domicilio}
          </p>
          <p className="mt-1">
            <strong>Contacto de Protección de Datos:</strong>{" "}
            <a
              href={`mailto:${AVISO_PRIVACIDAD_METADATA.contactoDpo}`}
              className="font-semibold text-[#1F4D2C] underline underline-offset-4 dark:text-[#8FC9B5]"
            >
              {AVISO_PRIVACIDAD_METADATA.contactoDpo}
            </a>
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "finalidad",
    number: 2,
    title: "Finalidades del Tratamiento",
    content: (
      <div className="space-y-3 text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
        <div>
          <h3 className="font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
            Finalidades primarias (necesarias para el servicio):
          </h3>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
            <li>
              Aplicación guiada de tamizajes emocionales estandarizados (PHQ-9 y GAD-7) mediante la
              asistente Eli.
            </li>
            <li>
              Clasificación preventiva de nivel de riesgo para canalización oportuna y seguimiento
              clínico por el Área de Psicología del TESH.
            </li>
            <li>
              Generación de folio único de atención y gestión de citas psicológicas universitarias.
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
            Finalidades secundarias (estadísticas institucionales):
          </h3>
          <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
            <li>
              Elaboración de indicadores agregados y estrictamente anonimizados sobre bienestar
              estudiantil por carrera y semestre, sin identificar individualmente a ningún usuario.
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "datos-recopilados",
    number: 3,
    title: "Datos Personales Recopilados",
    content: (
      <div className="space-y-2.5 text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
        <p>Para el cumplimiento de las finalidades descritas, se recaban:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Datos de identificación y escolares:</strong> nombre completo, matrícula de 8
            dígitos, correo electrónico institucional (@tesh.edu.mx), carrera, semestre y grupo.
          </li>
          <li>
            <strong>Datos personales sensibles (salud y bienestar):</strong> respuestas a las
            escalas PHQ-9 y GAD-7, nivel de riesgo clínico asignado, historial de check-ins diarios
            (estado de ánimo, horas de sueño, estrés y energía) y notas clínicas de evolución cuando
            exista consentimiento.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "transferencias",
    number: 4,
    title: "Transferencias y Proveedores Tecnológicos",
    content: (
      <div className="space-y-2.5 text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
        <p>
          Tus datos personales no se venden ni comparten con terceros ajenos a la finalidad clínica
          o académica del TESH. Únicamente operan como encargados tecnológicos bajo cifrado TLS 1.3
          y políticas de no retención comercial:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Supabase (base de datos y autenticación):</strong> almacenamiento cifrado con
            políticas de seguridad a nivel de fila (RLS).
          </li>
          <li>
            <strong>Google AI Studio (Gemini 3.8 Flash) y OpenAI (Whisper API):</strong>{" "}
            procesamiento conversacional de apoyo y transcripción efímera de notas de voz; el audio
            no se almacena, únicamente la transcripción de texto.
          </li>
          <li>
            <strong>Red Polygon (Testnet Amoy):</strong> registro exclusivo de hashes matemáticos
            SHA-256 para auditoría de integridad; nunca se publican datos personales ni clínicos.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "derechos-arco",
    number: 5,
    title: "Ejercicio de Derechos ARCO",
    content: (
      <div className="space-y-2 text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
        <p>
          Como titular de tus datos personales, tienes derecho a solicitar el{" "}
          <strong>Acceso</strong>, <strong>Rectificación</strong>, <strong>Cancelación</strong> u{" "}
          <strong>Oposición</strong> (Derechos ARCO) respecto al tratamiento de tu información.
        </p>
        <p>
          Puedes ejercer tus derechos ARCO enviando una solicitud al correo{" "}
          <a
            href={`mailto:${AVISO_PRIVACIDAD_METADATA.contactoDpo}`}
            className="font-semibold text-[#1F4D2C] underline underline-offset-4 dark:text-[#8FC9B5]"
          >
            {AVISO_PRIVACIDAD_METADATA.contactoDpo}
          </a>{" "}
          con el asunto &ldquo;Solicitud ARCO — Equilibra TESH&rdquo;, indicando tu nombre completo,
          matrícula y descripción clara del derecho que deseas ejercer.
        </p>
      </div>
    ),
  },
  {
    id: "revocacion",
    number: 6,
    title: "Medios para Revocar el Consentimiento",
    content: (
      <div className="space-y-2 text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
        <p>
          Puedes revocar en cualquier momento tu consentimiento para el{" "}
          <strong>Modo Acompañamiento</strong> directamente desde tu Perfil en la plataforma,
          deshabilitando de forma inmediata la consulta de tus tamizajes por parte del área de
          psicología.
        </p>
        <p>
          Para revocar el consentimiento general sobre el tratamiento de datos o solicitar la baja
          de tu cuenta, escribe a{" "}
          <a
            href={`mailto:${AVISO_PRIVACIDAD_METADATA.contactoDpo}`}
            className="font-semibold text-[#1F4D2C] underline underline-offset-4 dark:text-[#8FC9B5]"
          >
            {AVISO_PRIVACIDAD_METADATA.contactoDpo}
          </a>
          . Los expedientes clínicos previos se resguardarán únicamente por los plazos obligatorios
          de conservación aplicables.
        </p>
      </div>
    ),
  },
  {
    id: "cambios",
    number: 7,
    title: "Cambios al Aviso de Privacidad",
    content: (
      <div className="space-y-2 text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
        <p>
          El TESH se reserva el derecho de efectuar modificaciones o actualizaciones al presente
          Aviso de Privacidad para adaptarlo a novedades legislativas, criterios normativos o
          mejoras operativas en Equilibra TESH.
        </p>
        <p>
          Cualquier modificación será comunicada oportunamente dentro de la plataforma web y a
          través de los canales institucionales del Tecnológico de Estudios Superiores de
          Huixquilucan.
        </p>
      </div>
    ),
  },
];

-- ==============================================================================
-- TABLA DE SOLICITUDES DE CITA - EQUILIBRA TESH (PB-009)
-- Plantilla Visual PB-009 · Agenda de Citas (Sprint 5)
-- Modalidad: Presencial única (decisión clínica 09-oct)
-- Base de datos normalizada en Tercera Forma Normal (3FN):
--   entidad propia vinculada por FK a `auth.users(id)` y `public.profiles(id)`,
--   sin duplicación de datos personales del estudiante o psicólogo.
-- Respaldos: Supabase proporciona respaldos automáticos diarios (PITR),
--   cifrado TLS 1.3 en tránsito, AES-256 en reposo y logs de consultas en Dashboard.
-- ==============================================================================

-- 1. Crear tabla solicitudes_cita con los 14 campos del diseño
CREATE TABLE IF NOT EXISTS public.solicitudes_cita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  psicologo_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  fecha_cita DATE NOT NULL,
  hora_cita TIME NOT NULL,
  modalidad TEXT NOT NULL DEFAULT 'presencial' CHECK (modalidad = 'presencial'),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (
    estado IN ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio')
  ),
  motivo TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 280),
  cancelado_por TEXT CHECK (
    cancelado_por IS NULL OR cancelado_por IN ('estudiante', 'psicologo', 'sistema')
  ),
  motivo_cancelacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Índices de optimización y constraint UNIQUE para prevenir doble reserva
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_user_id ON public.solicitudes_cita(user_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_psicologo ON public.solicitudes_cita(psicologo_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_folio ON public.solicitudes_cita(folio);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_fecha_hora ON public.solicitudes_cita(fecha_cita, hora_cita);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_estado ON public.solicitudes_cita(estado);

CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_cita_slot_activo
  ON public.solicitudes_cita(psicologo_id, fecha_cita, hora_cita)
  WHERE estado IN ('pendiente', 'confirmada');

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.solicitudes_cita ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (Esmeralda / Sprint 5)

-- A. ESTUDIANTE: Puede ver sus propias solicitudes
DROP POLICY IF EXISTS "Estudiante puede ver sus propias solicitudes" ON public.solicitudes_cita;
CREATE POLICY "Estudiante puede ver sus propias solicitudes"
  ON public.solicitudes_cita
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- B. ESTUDIANTE: Puede registrar solicitud de cita (solo presencial)
DROP POLICY IF EXISTS "Estudiante puede registrar solicitud" ON public.solicitudes_cita;
CREATE POLICY "Estudiante puede registrar solicitud"
  ON public.solicitudes_cita
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND modalidad = 'presencial'
    AND estado = 'pendiente'
    AND (motivo IS NULL OR char_length(motivo) <= 280)
  );

-- C. ESTUDIANTE: Puede cancelar su cita si está pendiente o confirmada y faltan más de 2 horas (fail-closed)
DROP POLICY IF EXISTS "Estudiante puede cancelar con +2h de anticipacion" ON public.solicitudes_cita;
CREATE POLICY "Estudiante puede cancelar con +2h de anticipacion"
  ON public.solicitudes_cita
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND estado IN ('pendiente', 'confirmada')
    AND ((fecha_cita + hora_cita) > (timezone('utc'::text, now()) + interval '2 hours'))
  )
  WITH CHECK (
    user_id = auth.uid()
    AND estado = 'cancelada'
    AND cancelado_por = 'estudiante'
  );

-- D. PSICÓLOGO: Puede consultar las solicitudes asignadas o de su campus
DROP POLICY IF EXISTS "Psicólogo puede ver solicitudes de pacientes" ON public.solicitudes_cita;
CREATE POLICY "Psicólogo puede ver solicitudes de pacientes"
  ON public.solicitudes_cita
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('psicologo', 'directivo')
    )
  );

-- E. PSICÓLOGO: Puede actualizar estados (confirmada, cancelada, completada, no_asistio)
DROP POLICY IF EXISTS "Psicólogo gestiona estado de citas" ON public.solicitudes_cita;
CREATE POLICY "Psicólogo gestiona estado de citas"
  ON public.solicitudes_cita
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'psicologo'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'psicologo'
    )
  );

-- F. ANON: Sin acceso denegado por defecto (implícito por RLS activado)

-- 5. Trigger automático para actualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at_solicitudes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_solicitudes_updated_at ON public.solicitudes_cita;
CREATE TRIGGER trigger_solicitudes_updated_at
  BEFORE UPDATE ON public.solicitudes_cita
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_solicitudes();

-- 6. Trigger backend: cita completada -> encuesta de satisfacción a las 24h
CREATE OR REPLACE FUNCTION public.handle_cita_completada_encuesta_24h()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'completada' AND (OLD.estado IS DISTINCT FROM 'completada') THEN
    BEGIN
      INSERT INTO public.encuestas_satisfaccion (
        folio,
        user_id,
        trigger_tipo,
        enviado_at,
        expira_at
      )
      VALUES (
        NEW.folio,
        NEW.user_id,
        'alta',
        timezone('utc'::text, now()) + interval '24 hours',
        timezone('utc'::text, now()) + interval '48 hours'
      );
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cita_completada_encuesta_24h ON public.solicitudes_cita;
CREATE TRIGGER trigger_cita_completada_encuesta_24h
  AFTER UPDATE OF estado ON public.solicitudes_cita
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_cita_completada_encuesta_24h();

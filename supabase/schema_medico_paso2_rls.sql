-- ==============================================================================
-- EQUILIBRA TESH — MIGRACIÓN MÉDICO + PRIVACIDAD LFPDPPP (PASO 2 DE 2)
-- ==============================================================================
-- REQUISITO PREVIO:
--   Haber ejecutado y confirmado `supabase/schema_medico_paso1_enum.sql`
--   en una transacción separada para que `'medico'` exista en `public.app_role`.
--
-- ALCANCE DE ESTE SCRIPT (IDEMPOTENTE):
--   1. `solicitudes_cita`: agrega `tipo_profesional` ('psicologo' | 'medico') y
--      permite `'medico'` en `cancelado_por`.
--   2. `canalizaciones`: agrega `rol_canalizador` ('tutor' | 'medico' | 'jefatura').
--   3. `expedientes_medicos`: tabla independiente para notas médicas físicas
--      (LFPDPPP: separada totalmente de `expedientes_clinicos`).
--   4. Políticas RLS actualizadas para aislar al rol `'medico'`:
--      - El médico ve únicamente solicitudes médicas, perfiles académicos básicos
--        de estudiantes, directorio institucional y sus propios `expedientes_medicos`.
--      - El médico puede crear canalizaciones hacia Psicología (`rol_canalizador = 'medico'`)
--        y notificar al estudiante en `alertas_inasistencia`.
--      - El médico NUNCA tiene políticas ni acceso sobre `respuestas_tamizaje`,
--        `resultados_scoring`, `pacientes`, `alertas`, `checkins`, `notas_voz`
--        ni `expedientes_clinicos`.
-- ==============================================================================


-- ------------------------------------------------------------------------------
-- 1. ACTUALIZAR `solicitudes_cita` CON ESPECIALIDAD Y CANCELACIÓN MÉDICA
-- ------------------------------------------------------------------------------
ALTER TABLE public.solicitudes_cita
  ADD COLUMN IF NOT EXISTS tipo_profesional TEXT NOT NULL DEFAULT 'psicologo';

ALTER TABLE public.solicitudes_cita
  DROP CONSTRAINT IF EXISTS solicitudes_cita_tipo_profesional_check;

ALTER TABLE public.solicitudes_cita
  ADD CONSTRAINT solicitudes_cita_tipo_profesional_check
  CHECK (tipo_profesional IN ('psicologo', 'medico'));

CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_tipo_profesional
  ON public.solicitudes_cita(tipo_profesional);

ALTER TABLE public.solicitudes_cita
  DROP CONSTRAINT IF EXISTS solicitudes_cita_cancelado_por_check;

ALTER TABLE public.solicitudes_cita
  ADD CONSTRAINT solicitudes_cita_cancelado_por_check
  CHECK (
    cancelado_por IS NULL
    OR cancelado_por IN ('estudiante', 'psicologo', 'medico', 'sistema')
  );


-- ------------------------------------------------------------------------------
-- 2. ACTUALIZAR `canalizaciones` CON ORIGEN (`rol_canalizador`)
-- ------------------------------------------------------------------------------
ALTER TABLE public.canalizaciones
  ADD COLUMN IF NOT EXISTS rol_canalizador TEXT NOT NULL DEFAULT 'tutor';

ALTER TABLE public.canalizaciones
  DROP CONSTRAINT IF EXISTS canalizaciones_rol_canalizador_check;

ALTER TABLE public.canalizaciones
  ADD CONSTRAINT canalizaciones_rol_canalizador_check
  CHECK (rol_canalizador IN ('tutor', 'medico', 'jefatura'));

ALTER TABLE public.canalizaciones
  DROP CONSTRAINT IF EXISTS canalizaciones_prioridad_check;

ALTER TABLE public.canalizaciones
  ADD CONSTRAINT canalizaciones_prioridad_check
  CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente'));


-- ------------------------------------------------------------------------------
-- 3. CREAR TABLA `expedientes_medicos` (SEPARADA DE `expedientes_clinicos`)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expedientes_medicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medico_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha_consulta DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo_consulta TEXT NOT NULL,
  presion_arterial TEXT,
  frecuencia_cardiaca TEXT,
  temperatura TEXT,
  diagnostico_fisico TEXT NOT NULL,
  indicaciones TEXT NOT NULL DEFAULT '',
  canalizado_psicologia BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_expedientes_medicos_medico
  ON public.expedientes_medicos(medico_id, fecha_consulta DESC);

CREATE INDEX IF NOT EXISTS idx_expedientes_medicos_estudiante
  ON public.expedientes_medicos(estudiante_id, fecha_consulta DESC);

CREATE OR REPLACE FUNCTION public.handle_updated_at_expedientes_medicos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_expedientes_medicos_updated_at ON public.expedientes_medicos;
CREATE TRIGGER trigger_expedientes_medicos_updated_at
  BEFORE UPDATE ON public.expedientes_medicos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_expedientes_medicos();

ALTER TABLE public.expedientes_medicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Médico consulta sus propios expedientes médicos" ON public.expedientes_medicos;
CREATE POLICY "Médico consulta sus propios expedientes médicos"
  ON public.expedientes_medicos FOR SELECT
  TO authenticated
  USING (
    medico_id = auth.uid()
    AND public.current_user_role() = 'medico'
  );

DROP POLICY IF EXISTS "Médico registra expedientes médicos" ON public.expedientes_medicos;
CREATE POLICY "Médico registra expedientes médicos"
  ON public.expedientes_medicos FOR INSERT
  TO authenticated
  WITH CHECK (
    medico_id = auth.uid()
    AND public.current_user_role() = 'medico'
  );

DROP POLICY IF EXISTS "Médico actualiza sus expedientes médicos" ON public.expedientes_medicos;
CREATE POLICY "Médico actualiza sus expedientes médicos"
  ON public.expedientes_medicos FOR UPDATE
  TO authenticated
  USING (
    medico_id = auth.uid()
    AND public.current_user_role() = 'medico'
  )
  WITH CHECK (
    medico_id = auth.uid()
    AND public.current_user_role() = 'medico'
  );


-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS DE `profiles` PARA MÉDICO Y DIRECTORIO INSTITUCIONAL
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados consultan directorio de psicólogos y tutores" ON public.profiles;
DROP POLICY IF EXISTS "Autenticados consultan directorio de psicólogos, médicos y tutores" ON public.profiles;
CREATE POLICY "Autenticados consultan directorio de psicólogos, médicos y tutores"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    rol IN (
      'psicologo'::public.app_role,
      'medico'::public.app_role,
      'tutor'::public.app_role
    )
  );

DROP POLICY IF EXISTS "Médico ve perfil académico básico de estudiantes" ON public.profiles;
CREATE POLICY "Médico ve perfil académico básico de estudiantes"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'medico'
    AND rol = 'estudiante'::public.app_role
  );


-- ------------------------------------------------------------------------------
-- 5. POLÍTICAS RLS SEPARADAS EN `solicitudes_cita` (PSICÓLOGO vs MÉDICO)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Psicólogo y directivo ven solicitudes de pacientes" ON public.solicitudes_cita;
DROP POLICY IF EXISTS "Psicólogo ve solicitudes psicológicas" ON public.solicitudes_cita;
CREATE POLICY "Psicólogo ve solicitudes psicológicas"
  ON public.solicitudes_cita FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'psicologo'
    AND tipo_profesional = 'psicologo'
  );

DROP POLICY IF EXISTS "Directivo y jefatura ven solicitudes" ON public.solicitudes_cita;
CREATE POLICY "Directivo y jefatura ven solicitudes"
  ON public.solicitudes_cita FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('directivo', 'jefatura', 'coordinador'));

DROP POLICY IF EXISTS "Médico ve solicitudes médicas" ON public.solicitudes_cita;
CREATE POLICY "Médico ve solicitudes médicas"
  ON public.solicitudes_cita FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'medico'
    AND tipo_profesional = 'medico'
  );

DROP POLICY IF EXISTS "Psicólogo gestiona estado de citas" ON public.solicitudes_cita;
CREATE POLICY "Psicólogo gestiona estado de citas"
  ON public.solicitudes_cita FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'psicologo'
    AND tipo_profesional = 'psicologo'
  )
  WITH CHECK (
    public.current_user_role() = 'psicologo'
    AND tipo_profesional = 'psicologo'
  );

DROP POLICY IF EXISTS "Médico gestiona estado de citas médicas" ON public.solicitudes_cita;
CREATE POLICY "Médico gestiona estado de citas médicas"
  ON public.solicitudes_cita FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'medico'
    AND tipo_profesional = 'medico'
  )
  WITH CHECK (
    public.current_user_role() = 'medico'
    AND tipo_profesional = 'medico'
  );


-- ------------------------------------------------------------------------------
-- 6. CANALIZACIONES MÉDICO -> PSICÓLOGO Y ALERTAS AL ESTUDIANTE
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tutores crean canalizaciones" ON public.canalizaciones;
DROP POLICY IF EXISTS "Tutores y médico crean canalizaciones" ON public.canalizaciones;
CREATE POLICY "Tutores y médico crean canalizaciones"
  ON public.canalizaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.current_user_role() IN ('tutor', 'medico', 'directivo', 'jefatura', 'coordinador')
  );

DROP POLICY IF EXISTS "Tutores registran alertas al canalizar" ON public.alertas_inasistencia;
DROP POLICY IF EXISTS "Tutores y médico registran alertas al canalizar" ON public.alertas_inasistencia;
CREATE POLICY "Tutores y médico registran alertas al canalizar"
  ON public.alertas_inasistencia FOR INSERT
  TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.current_user_role() IN ('tutor', 'medico', 'directivo', 'jefatura', 'coordinador')
  );


-- ------------------------------------------------------------------------------
-- NOTA LFPDPPP:
-- Las tablas `expedientes_clinicos`, `pacientes`, `respuestas_tamizaje`,
-- `resultados_scoring`, `alertas`, `checkins` y `notas_voz` NO contienen
-- ninguna política RLS para el rol `'medico'`, garantizando aislamiento total
-- de datos psicológicos sensibles.
-- ==============================================================================

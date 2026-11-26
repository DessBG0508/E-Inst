-- ==============================================================================
-- EQUILIBRA TESH — MÓDULO EDUCACIÓN DUAL / PRUEBA CATTELL (16PF)
-- Normalización 3FN + Seguridad RLS + RPC Directorio de Aspirantes
-- ==============================================================================
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> Run
-- Requisitos previos: `public.profiles` y `public.current_user_role()` existentes.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CONVOCATORIAS DEL PROGRAMA DUAL
--    Agrupa cohortes o periodos (ej. "Educación Dual 2026-2") de todas las carreras.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convocatorias_dual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  periodo TEXT NOT NULL,
  descripcion TEXT,
  fecha_limite DATE,
  activa BOOLEAN NOT NULL DEFAULT true,
  creado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_convocatorias_dual_activa
  ON public.convocatorias_dual(activa, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. EVALUACIONES CATTELL 16PF (Entidad asociativa N:M Convocatoria <-> Estudiante)
--    Solo existen filas para estudiantes explícitamente seleccionados/habilitados.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evaluaciones_cattell (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id UUID NOT NULL REFERENCES public.convocatorias_dual(id) ON DELETE CASCADE,
  estudiante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_acceso UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'completado')),
  total_reactivos INTEGER NOT NULL DEFAULT 64 CHECK (total_reactivos > 0),
  reactivos_respondidos INTEGER NOT NULL DEFAULT 0 CHECK (reactivos_respondidos >= 0),
  puntajes_brutos JSONB NOT NULL DEFAULT '{}'::jsonb,
  puntajes_decatipos JSONB NOT NULL DEFAULT '{}'::jsonb,
  factores_globales JSONB NOT NULL DEFAULT '{}'::jsonb,
  pre_recomendacion TEXT
    CHECK (pre_recomendacion IS NULL OR pre_recomendacion IN ('apto', 'apto_con_observaciones', 'no_apto')),
  dictamen TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (dictamen IN ('pendiente', 'apto', 'apto_con_observaciones', 'no_apto')),
  observaciones_psicologo TEXT,
  habilitado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evaluado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  fecha_inicio TIMESTAMPTZ,
  fecha_completado TIMESTAMPTZ,
  fecha_dictamen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_evaluacion_convocatoria_estudiante UNIQUE (convocatoria_id, estudiante_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_cattell_convocatoria
  ON public.evaluaciones_cattell(convocatoria_id, estado, dictamen);
CREATE INDEX IF NOT EXISTS idx_eval_cattell_estudiante
  ON public.evaluaciones_cattell(estudiante_id, estado);
CREATE INDEX IF NOT EXISTS idx_eval_cattell_token
  ON public.evaluaciones_cattell(token_acceso);

-- ------------------------------------------------------------------------------
-- 3. RESPUESTAS INDIVIDUALES CATTELL (Relación 1:N con `evaluaciones_cattell`)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.respuestas_cattell (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id UUID NOT NULL REFERENCES public.evaluaciones_cattell(id) ON DELETE CASCADE,
  numero_pregunta INTEGER NOT NULL CHECK (numero_pregunta > 0),
  factor_codigo TEXT NOT NULL,
  opcion TEXT NOT NULL CHECK (opcion IN ('A', 'B', 'C')),
  puntos INTEGER NOT NULL CHECK (puntos BETWEEN 0 AND 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_respuesta_evaluacion_pregunta UNIQUE (evaluacion_id, numero_pregunta)
);

CREATE INDEX IF NOT EXISTS idx_respuestas_cattell_eval
  ON public.respuestas_cattell(evaluacion_id, numero_pregunta);

-- ------------------------------------------------------------------------------
-- 4. TRIGGERS DE INTEGRIDAD Y PROTECCIÓN CLÍNICA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at_cattell()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_convocatorias_dual_updated ON public.convocatorias_dual;
CREATE TRIGGER trg_convocatorias_dual_updated
  BEFORE UPDATE ON public.convocatorias_dual
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at_cattell();

DROP TRIGGER IF EXISTS trg_respuestas_cattell_updated ON public.respuestas_cattell;
CREATE TRIGGER trg_respuestas_cattell_updated
  BEFORE UPDATE ON public.respuestas_cattell
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at_cattell();

-- Evita que un estudiante altere su dictamen, su token o reabra una prueba completada
CREATE OR REPLACE FUNCTION public.proteger_evaluacion_cattell()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  NEW.updated_at := timezone('utc'::text, now());

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_role := public.current_user_role();

  IF v_role <> 'psicologo' THEN
    IF OLD.estado = 'completado' THEN
      RAISE EXCEPTION 'La evaluación Cattell ya fue completada y no puede modificarse.';
    END IF;

    -- Conservar campos administrativos/clínicos intactos si actualiza el estudiante
    NEW.convocatoria_id := OLD.convocatoria_id;
    NEW.estudiante_id := OLD.estudiante_id;
    NEW.token_acceso := OLD.token_acceso;
    NEW.dictamen := OLD.dictamen;
    NEW.observaciones_psicologo := OLD.observaciones_psicologo;
    NEW.habilitado_por := OLD.habilitado_por;
    NEW.evaluado_por := OLD.evaluado_por;
    NEW.fecha_envio := OLD.fecha_envio;
    NEW.fecha_dictamen := OLD.fecha_dictamen;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluaciones_cattell_protect ON public.evaluaciones_cattell;
CREATE TRIGGER trg_evaluaciones_cattell_protect
  BEFORE UPDATE ON public.evaluaciones_cattell
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_evaluacion_cattell();

-- ------------------------------------------------------------------------------
-- 5. SEGURIDAD POR FILA (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.convocatorias_dual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones_cattell ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respuestas_cattell ENABLE ROW LEVEL SECURITY;

-- convocatorias_dual
DROP POLICY IF EXISTS "Psicologo gestiona convocatorias dual" ON public.convocatorias_dual;
CREATE POLICY "Psicologo gestiona convocatorias dual"
  ON public.convocatorias_dual
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'psicologo')
  WITH CHECK (public.current_user_role() = 'psicologo');

DROP POLICY IF EXISTS "Estudiante ve solo su convocatoria habilitada" ON public.convocatorias_dual;
CREATE POLICY "Estudiante ve solo su convocatoria habilitada"
  ON public.convocatorias_dual
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.evaluaciones_cattell ec
      WHERE ec.convocatoria_id = convocatorias_dual.id
        AND ec.estudiante_id = auth.uid()
    )
  );

-- evaluaciones_cattell
DROP POLICY IF EXISTS "Psicologo gestiona evaluaciones cattell" ON public.evaluaciones_cattell;
CREATE POLICY "Psicologo gestiona evaluaciones cattell"
  ON public.evaluaciones_cattell
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'psicologo')
  WITH CHECK (public.current_user_role() = 'psicologo');

DROP POLICY IF EXISTS "Estudiante ve su propia evaluacion cattell" ON public.evaluaciones_cattell;
CREATE POLICY "Estudiante ve su propia evaluacion cattell"
  ON public.evaluaciones_cattell
  FOR SELECT
  TO authenticated
  USING (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Estudiante actualiza su evaluacion en progreso" ON public.evaluaciones_cattell;
CREATE POLICY "Estudiante actualiza su evaluacion en progreso"
  ON public.evaluaciones_cattell
  FOR UPDATE
  TO authenticated
  USING (estudiante_id = auth.uid() AND estado <> 'completado')
  WITH CHECK (estudiante_id = auth.uid());

-- respuestas_cattell
DROP POLICY IF EXISTS "Psicologo lee respuestas cattell" ON public.respuestas_cattell;
CREATE POLICY "Psicologo lee respuestas cattell"
  ON public.respuestas_cattell
  FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'psicologo');

DROP POLICY IF EXISTS "Estudiante lee sus respuestas cattell" ON public.respuestas_cattell;
CREATE POLICY "Estudiante lee sus respuestas cattell"
  ON public.respuestas_cattell
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.evaluaciones_cattell ec
      WHERE ec.id = respuestas_cattell.evaluacion_id
        AND ec.estudiante_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Estudiante guarda respuestas mientras no complete" ON public.respuestas_cattell;
CREATE POLICY "Estudiante guarda respuestas mientras no complete"
  ON public.respuestas_cattell
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.evaluaciones_cattell ec
      WHERE ec.id = respuestas_cattell.evaluacion_id
        AND ec.estudiante_id = auth.uid()
        AND ec.estado <> 'completado'
    )
  );

DROP POLICY IF EXISTS "Estudiante actualiza respuestas mientras no complete" ON public.respuestas_cattell;
CREATE POLICY "Estudiante actualiza respuestas mientras no complete"
  ON public.respuestas_cattell
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.evaluaciones_cattell ec
      WHERE ec.id = respuestas_cattell.evaluacion_id
        AND ec.estudiante_id = auth.uid()
        AND ec.estado <> 'completado'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.evaluaciones_cattell ec
      WHERE ec.id = respuestas_cattell.evaluacion_id
        AND ec.estudiante_id = auth.uid()
        AND ec.estado <> 'completado'
    )
  );

-- ------------------------------------------------------------------------------
-- 6. RPC PARA LISTAR ESTUDIANTES DE TODAS LAS CARRERAS (SOLO PSICOLOGÍA)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_estudiantes_dual()
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  email TEXT,
  matricula TEXT,
  carrera TEXT,
  semestre TEXT,
  grupo TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'psicologo' THEN
    RAISE EXCEPTION 'Acceso restringido al área de Psicología.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(btrim(p.nombre), ''), NULLIF(btrim(p.name), ''), split_part(p.email, '@', 1)) AS nombre,
    p.email,
    p.matricula,
    p.carrera,
    p.semestre,
    p.grupo
  FROM public.profiles p
  WHERE COALESCE(p.rol::text, p.role::text, 'estudiante') = 'estudiante'
  ORDER BY p.carrera NULLS LAST, nombre ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_estudiantes_dual() TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. VISTA DE CONTEO Y ESTADÍSTICAS POR CONVOCATORIA DUAL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_resumen_cattell_dual
WITH (security_invoker = true) AS
SELECT
  c.id AS convocatoria_id,
  c.nombre AS convocatoria_nombre,
  c.periodo,
  c.activa,
  COUNT(e.id)::INTEGER AS total_habilitados,
  COUNT(e.id) FILTER (WHERE e.estado = 'pendiente')::INTEGER AS pendientes,
  COUNT(e.id) FILTER (WHERE e.estado = 'en_progreso')::INTEGER AS en_progreso,
  COUNT(e.id) FILTER (WHERE e.estado = 'completado')::INTEGER AS completados,
  COUNT(e.id) FILTER (WHERE e.dictamen = 'pendiente')::INTEGER AS dictamen_pendiente,
  COUNT(e.id) FILTER (WHERE e.dictamen = 'apto')::INTEGER AS aptos,
  COUNT(e.id) FILTER (WHERE e.dictamen = 'apto_con_observaciones')::INTEGER AS apto_con_observaciones,
  COUNT(e.id) FILTER (WHERE e.dictamen = 'no_apto')::INTEGER AS no_aptos
FROM public.convocatorias_dual c
LEFT JOIN public.evaluaciones_cattell e ON e.convocatoria_id = c.id
GROUP BY c.id, c.nombre, c.periodo, c.activa;

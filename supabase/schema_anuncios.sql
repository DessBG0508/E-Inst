-- ==============================================================================
-- MÓDULO DE ANUNCIOS Y TALLERES - EQUILIBRA TESH
-- Tablas: public.anuncios y public.anuncios_inscripciones
-- Incluye RLS estricto, triggers de cupo/inscripciones y bucket anuncios-flyers.
-- ==============================================================================

-- 1. Tabla principal de anuncios y talleres
CREATE TABLE IF NOT EXISTS public.anuncios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  descripcion_larga TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('taller', 'recordatorio', 'informativo', 'evento')),
  fecha_evento DATE,
  hora_inicio TEXT,
  hora_fin TEXT,
  lugar TEXT,
  ponente TEXT,
  requisitos TEXT,
  cupo INTEGER CHECK (cupo IS NULL OR cupo > 0),
  inscritos INTEGER NOT NULL DEFAULT 0 CHECK (inscritos >= 0),
  publico_objetivo TEXT NOT NULL DEFAULT 'todos'
    CHECK (publico_objetivo IN ('todos', 'rojo', 'amarillo', 'verde', 'sin_tamizaje')),
  imagen_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anuncios_activo ON public.anuncios(activo);
CREATE INDEX IF NOT EXISTS idx_anuncios_tipo ON public.anuncios(tipo);
CREATE INDEX IF NOT EXISTS idx_anuncios_fecha_evento ON public.anuncios(fecha_evento);

-- 2. Tabla de inscripciones de estudiantes
CREATE TABLE IF NOT EXISTS public.anuncios_inscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  anuncio_id UUID NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(estudiante_id, anuncio_id)
);

CREATE INDEX IF NOT EXISTS idx_anuncios_inscripciones_estudiante
  ON public.anuncios_inscripciones(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_anuncios_inscripciones_anuncio
  ON public.anuncios_inscripciones(anuncio_id);

-- 3. Trigger para actualizar updated_at automáticamente en anuncios
CREATE OR REPLACE FUNCTION public.set_anuncios_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anuncios_updated_at ON public.anuncios;
CREATE TRIGGER trg_anuncios_updated_at
  BEFORE UPDATE ON public.anuncios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_anuncios_updated_at();

-- 4. Trigger BEFORE INSERT para validar que el anuncio esté activo y tenga cupo disponible
CREATE OR REPLACE FUNCTION public.validar_cupo_anuncio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupo INTEGER;
  v_inscritos INTEGER;
  v_activo BOOLEAN;
BEGIN
  SELECT cupo, inscritos, activo
    INTO v_cupo, v_inscritos, v_activo
    FROM public.anuncios
    WHERE id = NEW.anuncio_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El anuncio solicitado no existe.';
  END IF;

  IF v_activo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Este anuncio ya no está disponible para inscripciones.';
  END IF;

  IF v_cupo IS NOT NULL AND COALESCE(v_inscritos, 0) >= v_cupo THEN
    RAISE EXCEPTION 'Cupo lleno para este anuncio o taller.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_cupo_anuncio ON public.anuncios_inscripciones;
CREATE TRIGGER trg_validar_cupo_anuncio
  BEFORE INSERT ON public.anuncios_inscripciones
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_cupo_anuncio();

-- 5. Trigger AFTER INSERT OR DELETE para mantener actualizado el contador inscritos
CREATE OR REPLACE FUNCTION public.sincronizar_inscritos_anuncio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anuncio_id UUID;
  v_total INTEGER;
BEGIN
  v_anuncio_id := COALESCE(NEW.anuncio_id, OLD.anuncio_id);

  SELECT COUNT(*)::INTEGER
    INTO v_total
    FROM public.anuncios_inscripciones
    WHERE anuncio_id = v_anuncio_id;

  UPDATE public.anuncios
    SET inscritos = COALESCE(v_total, 0),
        updated_at = now()
    WHERE id = v_anuncio_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_inscritos_anuncio ON public.anuncios_inscripciones;
CREATE TRIGGER trg_sincronizar_inscritos_anuncio
  AFTER INSERT OR DELETE ON public.anuncios_inscripciones
  FOR EACH ROW
  EXECUTE FUNCTION public.sincronizar_inscritos_anuncio();

-- 6. Row Level Security (RLS)
ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anuncios_inscripciones ENABLE ROW LEVEL SECURITY;

-- Estudiantes y usuarios autenticados ven anuncios activos
DROP POLICY IF EXISTS "Usuarios ven anuncios activos" ON public.anuncios;
CREATE POLICY "Usuarios ven anuncios activos"
  ON public.anuncios
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Psicólogos y directivos ven todos los anuncios (incluyendo ocultos)
DROP POLICY IF EXISTS "Psicólogo y directivo ven todos los anuncios" ON public.anuncios;
CREATE POLICY "Psicólogo y directivo ven todos los anuncios"
  ON public.anuncios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
    )
  );

-- Psicólogos y directivos gestionan CRUD completo de anuncios
DROP POLICY IF EXISTS "Psicólogo y directivo gestionan anuncios" ON public.anuncios;
CREATE POLICY "Psicólogo y directivo gestionan anuncios"
  ON public.anuncios
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
    )
  );

-- Inscripciones: cada estudiante consulta, registra y cancela sus propias inscripciones
DROP POLICY IF EXISTS "Estudiantes consultan sus inscripciones" ON public.anuncios_inscripciones;
CREATE POLICY "Estudiantes consultan sus inscripciones"
  ON public.anuncios_inscripciones
  FOR SELECT
  TO authenticated
  USING (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Estudiantes se inscriben a anuncios" ON public.anuncios_inscripciones;
CREATE POLICY "Estudiantes se inscriben a anuncios"
  ON public.anuncios_inscripciones
  FOR INSERT
  TO authenticated
  WITH CHECK (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Estudiantes cancelan sus inscripciones" ON public.anuncios_inscripciones;
CREATE POLICY "Estudiantes cancelan sus inscripciones"
  ON public.anuncios_inscripciones
  FOR DELETE
  TO authenticated
  USING (estudiante_id = auth.uid());

-- Psicólogo y directivo pueden consultar todas las inscripciones
DROP POLICY IF EXISTS "Psicólogo y directivo consultan inscripciones" ON public.anuncios_inscripciones;
CREATE POLICY "Psicólogo y directivo consultan inscripciones"
  ON public.anuncios_inscripciones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
    )
  );

-- 7. Bucket Supabase Storage para flyers (anuncios-flyers)
INSERT INTO storage.buckets (id, name, public)
VALUES ('anuncios-flyers', 'anuncios-flyers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Flyers de anuncios son públicos para lectura" ON storage.objects;
CREATE POLICY "Flyers de anuncios son públicos para lectura"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'anuncios-flyers');

DROP POLICY IF EXISTS "Psicólogos suben flyers de anuncios" ON storage.objects;
CREATE POLICY "Psicólogos suben flyers de anuncios"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'anuncios-flyers'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
    )
  );

DROP POLICY IF EXISTS "Psicólogos actualizan flyers de anuncios" ON storage.objects;
CREATE POLICY "Psicólogos actualizan flyers de anuncios"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'anuncios-flyers'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
    )
  );

DROP POLICY IF EXISTS "Psicólogos eliminan flyers de anuncios" ON storage.objects;
CREATE POLICY "Psicólogos eliminan flyers de anuncios"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'anuncios-flyers'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
    )
  );

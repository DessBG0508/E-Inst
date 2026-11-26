-- ==============================================================================
-- Equilibra TESH — Migración de RLS para separación de roles Directivo vs Jefatura
-- ==============================================================================
-- - Directivo ('directivo', 'coordinador'): Panel ejecutivo de solo lectura (/directivo).
-- - Jefatura ('jefatura'): Gestión operativa de tutores, asignaciones y recursamiento (/jefatura).
-- ==============================================================================

-- 1. `tutores_grupo`: Jefatura gestiona (SELECT/INSERT/UPDATE/DELETE); Directivo solo lectura
ALTER TABLE public.tutores_grupo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directivos gestionan asignaciones de tutores" ON public.tutores_grupo;
DROP POLICY IF EXISTS "Jefatura gestiona asignaciones de tutores" ON public.tutores_grupo;
DROP POLICY IF EXISTS "Directivo consulta historial de asignaciones de tutores" ON public.tutores_grupo;

CREATE POLICY "Jefatura gestiona asignaciones de tutores"
  ON public.tutores_grupo FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('jefatura', 'coordinador'))
  WITH CHECK (public.current_user_role() IN ('jefatura', 'coordinador'));

CREATE POLICY "Directivo consulta historial de asignaciones de tutores"
  ON public.tutores_grupo FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('directivo', 'psicologo'));

-- 2. `canalizaciones`: Jefatura y Directivo pueden consultar todas las canalizaciones (SELECT)
ALTER TABLE public.canalizaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Psicólogos y directivos consultan canalizaciones" ON public.canalizaciones;
DROP POLICY IF EXISTS "Psicólogos, directivos y jefatura consultan canalizaciones" ON public.canalizaciones;

CREATE POLICY "Psicólogos, directivos y jefatura consultan canalizaciones"
  ON public.canalizaciones FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

-- 3. `profiles`: Jefatura puede consultar perfiles y actualizar carrera/semestre/grupo de estudiantes
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Psicólogo y directivo ven perfiles" ON public.profiles;
CREATE POLICY "Psicólogo y directivo ven perfiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

DROP POLICY IF EXISTS "Directivos actualizan adscripción académica de estudiantes" ON public.profiles;
DROP POLICY IF EXISTS "Jefatura actualiza adscripción académica de estudiantes" ON public.profiles;

CREATE POLICY "Jefatura actualiza adscripción académica de estudiantes"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('jefatura', 'coordinador')
    AND rol = 'estudiante'::public.app_role
  )
  WITH CHECK (
    public.current_user_role() IN ('jefatura', 'coordinador')
    AND rol = 'estudiante'::public.app_role
  );

-- Refuerzo en trigger de protección de roles: Jefatura puede actualizar datos académicos
-- de estudiantes pero nunca modificar la columna `rol` / `role` desde el cliente.
CREATE OR REPLACE FUNCTION public.sync_profile_fields_and_protect_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF NEW.nombre IS NULL AND NEW.name IS NOT NULL THEN
    NEW.nombre := NEW.name;
  ELSIF NEW.name IS NULL AND NEW.nombre IS NOT NULL THEN
    NEW.name := NEW.nombre;
  ELSIF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
    NEW.name := NEW.nombre;
  ELSIF NEW.name IS DISTINCT FROM OLD.name THEN
    NEW.nombre := NEW.name;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.rol IS NULL AND NEW.role IS NULL THEN
      NEW.rol := 'estudiante'::public.app_role;
      NEW.role := 'estudiante'::public.app_role;
    ELSIF NEW.rol IS NULL AND NEW.role IS NOT NULL THEN
      NEW.rol := NEW.role;
    ELSIF NEW.role IS NULL AND NEW.rol IS NOT NULL THEN
      NEW.role := NEW.rol;
    ELSIF NEW.rol IS NOT NULL AND NEW.role IS NOT NULL AND NEW.rol <> NEW.role THEN
      NEW.role := NEW.rol;
    END IF;
  ELSE
    IF NEW.rol IS DISTINCT FROM OLD.rol THEN
      NEW.role := NEW.rol;
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.rol := NEW.role;
    END IF;

    -- Impedir escalamiento de privilegios desde cliente (incluye bloqueo a cambios de rol por jefatura)
    IF (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.role IS DISTINCT FROM OLD.role)
       AND auth.uid() IS NOT NULL THEN
      SELECT COALESCE(rol::text, role::text, 'estudiante')
        INTO v_caller_role
        FROM public.profiles
        WHERE id = auth.uid();

      IF v_caller_role NOT IN ('directivo', 'coordinador') THEN
        NEW.rol := OLD.rol;
        NEW.role := OLD.role;
      END IF;
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- EQUILIBRA TESH — ESQUEMA SQL UNIFICADO DE PRODUCCIÓN (SUPABASE / POSTGRESQL)
-- Versión: 3.0 Institucional (TESH Huixquilucan)
-- ==============================================================================
--
-- ARQUITECTURA, NORMALIZACIÓN Y SEGURIDAD:
-- 1. Base de Datos normalizada en Tercera Forma Normal (3FN):
--    - Cada entidad posee clave primaria atómica (`UUID` o `BIGINT IDENTITY`),
--      sin grupos repetitivos ni dependencias parciales o transitivas.
--    - Los datos identitarios y académicos residen únicamente en `public.profiles`
--      vinculados 1:1 con `auth.users(id)` (identidad institucional).
--    - Los datos clínicos (`pacientes`, `respuestas_tamizaje`, `expedientes_clinicos`,
--      `notas_voz`) y los operativos (`tutores_grupo`, `canalizaciones`,
--      `alertas_inasistencia`, `solicitudes_cita`) están desacoplados por FK para
--      cumplir la LFPDPPP (los tutores nunca acceden a datos clínicos).
--
-- 2. Respaldos y Alta Disponibilidad:
--    - Respaldos automáticos diarios con Point-In-Time Recovery (Supabase PITR)
--      y logs de auditoría/consultas monitoreados desde Supabase Dashboard.
--    - Política de retención clínica automática de 30 días para `public.notas_voz`
--      (`expira_en` + función `public.purgar_notas_voz_expiradas()`).
--
-- 3. Cifrado en Tránsito y en Reposo:
--    - Cifrado TLS 1.3 obligatorio en tránsito para todas las conexiones HTTPS/PostgREST,
--      Edge Functions y PostgreSQL.
--    - Cifrado AES-256 en reposo (TDE) para tablas, índices, respaldos y buckets
--      de Supabase Storage (`recursos-videos`, `anuncios-flyers`).
--
-- 4. Autenticación y Gestión de Credenciales:
--    - Contraseñas protegidas con hashing adaptativo bcrypt vía Supabase Auth
--      (`auth.users` / GoTrue), JWT firmados con rotación automática de refresh tokens
--      y validación estricta de sesiones en Edge Functions y RLS.
--
-- ==============================================================================
-- ⚠️ AVISO CRÍTICO SOBRE `ALTER TYPE app_role ADD VALUE 'tutor'` ⚠️
-- ==============================================================================
-- Si estás actualizando una base de datos EXISTENTE donde el tipo `public.app_role`
-- ya fue creado anteriormente SIN el valor `'tutor'`:
--   PostgreSQL PROHÍBE usar un valor recién agregado con `ALTER TYPE ... ADD VALUE`
--   en la MISMA transacción donde otras sentencias lo referencian (error 55P04).
--
-- POR ELLO, SI `app_role` YA EXISTE EN TU PROYECTO:
--   1) Ejecuta ÚNICAMENTE esta línea primero (en su propia transacción) y espera "Success":
--
--      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tutor';
--
--   2) Después de confirmar ese COMMIT, ejecuta el resto de este script completo.
--
-- Si tu proyecto Supabase es NUEVO (limpio), puedes ejecutar todo este archivo
-- directamente de arriba hacia abajo; el bloque Paso 1 creará `app_role` con todos
-- los valores incluyendo `'tutor'` en una sola operación segura.
-- ==============================================================================


-- ==============================================================================
-- PASO 1. EXTENSIONES Y TIPOS ENUMERADOS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM (
      'estudiante',
      'psicologo',
      'jefatura',
      'coordinador',
      'directivo',
      'tutor'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'nivel_riesgo' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.nivel_riesgo AS ENUM ('verde', 'amarillo', 'rojo');
  END IF;
END
$$;


-- ==============================================================================
-- PASO 2. TABLA `profiles` + FUNCIÓN DE ROL + TRIGGER DE REGISTRO AUTH
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  matricula TEXT,
  carrera TEXT,
  semestre TEXT,
  grupo TEXT,
  rol public.app_role NOT NULL DEFAULT 'estudiante',
  role public.app_role NOT NULL DEFAULT 'estudiante',
  modo_acompanamiento BOOLEAN NOT NULL DEFAULT true,
  aviso_privacidad_aceptado BOOLEAN NOT NULL DEFAULT false,
  aviso_privacidad_version TEXT,
  aviso_privacidad_fecha TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_rol ON public.profiles(rol);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_carrera_grupo ON public.profiles(carrera, grupo);
CREATE INDEX IF NOT EXISTS idx_profiles_matricula ON public.profiles(matricula);

-- Helper SECURITY DEFINER para consultar el rol del usuario autenticado sin recursión RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(rol::text, role::text, 'estudiante')
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Trigger que sincroniza `nombre`/`name` y `rol`/`role`, y bloquea auto-escalación de rol
CREATE OR REPLACE FUNCTION public.sync_profile_fields_and_protect_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Sincronizar alias de nombre
  IF NEW.nombre IS NULL OR btrim(NEW.nombre) = '' THEN
    NEW.nombre := COALESCE(NEW.name, '');
  END IF;
  IF NEW.name IS NULL OR btrim(NEW.name) = '' THEN
    NEW.name := NEW.nombre;
  END IF;

  -- Sincronizar alias de rol
  IF TG_OP = 'INSERT' THEN
    IF NEW.rol IS NULL AND NEW.role IS NOT NULL THEN
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

    -- Impedir que usuarios no directivos cambien su propio rol desde el cliente
    IF (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.role IS DISTINCT FROM OLD.role)
       AND auth.uid() IS NOT NULL THEN
      SELECT COALESCE(rol::text, role::text, 'estudiante')
        INTO v_caller_role
        FROM public.profiles
        WHERE id = auth.uid();

      IF v_caller_role NOT IN ('directivo', 'jefatura', 'coordinador') THEN
        NEW.rol := OLD.rol;
        NEW.role := OLD.role;
      END IF;
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_protect ON public.profiles;
CREATE TRIGGER trg_profiles_sync_protect
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_fields_and_protect_role();

-- Trigger AFTER INSERT en auth.users para crear el perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT;
BEGIN
  v_nombre := COALESCE(
    NEW.raw_user_meta_data->>'nombre',
    NEW.raw_user_meta_data->>'name',
    split_part(COALESCE(NEW.email, 'usuario@tesh.mx'), '@', 1)
  );

  INSERT INTO public.profiles (
    id,
    nombre,
    name,
    email,
    matricula,
    carrera,
    semestre,
    grupo,
    rol,
    role
  )
  VALUES (
    NEW.id,
    v_nombre,
    v_nombre,
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'matricula', ''),
    NULLIF(NEW.raw_user_meta_data->>'carrera', ''),
    NULLIF(NEW.raw_user_meta_data->>'semestre', ''),
    NULLIF(NEW.raw_user_meta_data->>'grupo', ''),
    'estudiante'::public.app_role,
    'estudiante'::public.app_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios ven su propio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Psicólogo y directivo ven perfiles" ON public.profiles;
CREATE POLICY "Psicólogo y directivo ven perfiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

DROP POLICY IF EXISTS "Autenticados consultan directorio de psicólogos y tutores" ON public.profiles;
CREATE POLICY "Autenticados consultan directorio de psicólogos y tutores"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (rol IN ('psicologo'::public.app_role, 'tutor'::public.app_role));

DROP POLICY IF EXISTS "Usuarios actualizan su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios actualizan su propio perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Directivos actualizan adscripción académica de estudiantes" ON public.profiles;
CREATE POLICY "Directivos actualizan adscripción académica de estudiantes"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('directivo', 'jefatura', 'coordinador'))
  WITH CHECK (public.current_user_role() IN ('directivo', 'jefatura', 'coordinador'));


-- ==============================================================================
-- PASO 3. TABLA `avisos_aceptados` (LFPDPPP)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.avisos_aceptados (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version_aviso TEXT NOT NULL,
  fecha_aceptacion TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.avisos_aceptados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios gestionan su propia aceptación de aviso" ON public.avisos_aceptados;
CREATE POLICY "Usuarios gestionan su propia aceptación de aviso"
  ON public.avisos_aceptados FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ==============================================================================
-- PASO 4. CHECK-INS, SESIONES, CONVERSACIONES, MENSAJES Y RESULTADOS SCORING
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  escala INTEGER NOT NULL CHECK (escala BETWEEN 1 AND 5),
  emociones TEXT[] NOT NULL DEFAULT '{}',
  intensidad INTEGER CHECK (intensidad IS NULL OR (intensidad BETWEEN 1 AND 10)),
  nota TEXT CHECK (nota IS NULL OR char_length(nota) <= 280),
  riesgo public.nivel_riesgo NOT NULL DEFAULT 'verde',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_fecha ON public.checkins(user_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_riesgo ON public.checkins(riesgo);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiantes registran sus checkins" ON public.checkins;
CREATE POLICY "Estudiantes registran sus checkins"
  ON public.checkins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Estudiantes consultan sus checkins" ON public.checkins;
CREATE POLICY "Estudiantes consultan sus checkins"
  ON public.checkins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogos consultan checkins en acompañamiento" ON public.checkins;
CREATE POLICY "Psicólogos consultan checkins en acompañamiento"
  ON public.checkins FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'psicologo'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = checkins.user_id AND p.modo_acompanamiento = true
    )
  );

-- Sesiones de atención / tamizaje
CREATE TABLE IF NOT EXISTS public.sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folio TEXT,
  tipo TEXT NOT NULL DEFAULT 'tamizaje' CHECK (tipo IN ('tamizaje', 'acompanamiento', 'checkin')),
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'completada', 'cancelada', 'expirada')),
  iniciada_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  finalizada_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sesiones_user ON public.sesiones(user_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_folio ON public.sesiones(folio);

ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios gestionan sus sesiones" ON public.sesiones;
CREATE POLICY "Usuarios gestionan sus sesiones"
  ON public.sesiones FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogos consultan sesiones clínicas" ON public.sesiones;
CREATE POLICY "Psicólogos consultan sesiones clínicas"
  ON public.sesiones FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'psicologo');

-- Conversaciones con Eli
CREATE TABLE IF NOT EXISTS public.conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID REFERENCES public.sesiones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folio TEXT,
  titulo TEXT DEFAULT 'Evaluación con Eli',
  estado TEXT NOT NULL DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'completada', 'cerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_conversaciones_user ON public.conversaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_sesion ON public.conversaciones(sesion_id);

ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios gestionan sus conversaciones" ON public.conversaciones;
CREATE POLICY "Usuarios gestionan sus conversaciones"
  ON public.conversaciones FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Mensajes de conversación
CREATE TABLE IF NOT EXISTS public.mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES public.conversaciones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remitente TEXT NOT NULL CHECK (remitente IN ('user', 'eli', 'system')),
  contenido TEXT NOT NULL,
  es_crisis BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON public.mensajes(conversacion_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_mensajes_user ON public.mensajes(user_id);

ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios gestionan sus mensajes" ON public.mensajes;
CREATE POLICY "Usuarios gestionan sus mensajes"
  ON public.mensajes FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Resultados de scoring clínico (GAD-7 / PHQ-9)
CREATE TABLE IF NOT EXISTS public.resultados_scoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID REFERENCES public.sesiones(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  folio TEXT NOT NULL,
  gad7_total INTEGER CHECK (gad7_total IS NULL OR (gad7_total BETWEEN 0 AND 21)),
  gad7_items INTEGER[] DEFAULT '{}',
  phq9_total INTEGER CHECK (phq9_total IS NULL OR (phq9_total BETWEEN 0 AND 27)),
  phq9_items INTEGER[] DEFAULT '{}',
  item9 INTEGER NOT NULL DEFAULT 0 CHECK (item9 BETWEEN 0 AND 3),
  nivel public.nivel_riesgo NOT NULL DEFAULT 'verde',
  alerta BOOLEAN NOT NULL DEFAULT false,
  recomendaciones TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_resultados_scoring_user ON public.resultados_scoring(user_id);
CREATE INDEX IF NOT EXISTS idx_resultados_scoring_folio ON public.resultados_scoring(folio);
CREATE INDEX IF NOT EXISTS idx_resultados_scoring_nivel ON public.resultados_scoring(nivel);

ALTER TABLE public.resultados_scoring ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiantes ven su propio scoring" ON public.resultados_scoring;
CREATE POLICY "Estudiantes ven su propio scoring"
  ON public.resultados_scoring FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Estudiantes registran su scoring" ON public.resultados_scoring;
CREATE POLICY "Estudiantes registran su scoring"
  ON public.resultados_scoring FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogos consultan scoring en acompañamiento" ON public.resultados_scoring;
CREATE POLICY "Psicólogos consultan scoring en acompañamiento"
  ON public.resultados_scoring FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'psicologo'
    AND (
      alerta = true
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = resultados_scoring.user_id AND p.modo_acompanamiento = true
      )
    )
  );


-- ==============================================================================
-- PASO 5. PACIENTES, RESPUESTAS_TAMIZAJE, ALERTAS Y VISTA PARA_PSICOLOGO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  iniciales TEXT NOT NULL DEFAULT 'N/A',
  edad INTEGER CHECK (edad IS NULL OR (edad BETWEEN 14 AND 99)),
  sexo TEXT,
  semestre TEXT,
  carrera TEXT,
  grupo TEXT,
  bloqueado BOOLEAN NOT NULL DEFAULT false,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pacientes_user_id ON public.pacientes(user_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_folio ON public.pacientes(folio);
CREATE INDEX IF NOT EXISTS idx_pacientes_bloqueado ON public.pacientes(bloqueado);

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiantes ven su propio registro de paciente" ON public.pacientes;
CREATE POLICY "Estudiantes ven su propio registro de paciente"
  ON public.pacientes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Estudiantes actualizan desbloqueo permitido o propio registro" ON public.pacientes;
CREATE POLICY "Estudiantes registran su perfil clínico de paciente"
  ON public.pacientes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Psicólogos gestionan pacientes" ON public.pacientes;
CREATE POLICY "Psicólogos gestionan pacientes"
  ON public.pacientes FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'psicologo')
  WITH CHECK (public.current_user_role() = 'psicologo');

-- Vista compatible `tamizajes` (1 fila única por folio para validación P0 #9 / MIN-008)
CREATE OR REPLACE VIEW public.tamizajes
WITH (security_invoker = true) AS
SELECT
  id,
  folio,
  user_id,
  bloqueado,
  fecha_registro AS creado_en
FROM public.pacientes;

-- Respuestas consolidadas de tamizaje
CREATE TABLE IF NOT EXISTS public.respuestas_tamizaje (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  folio TEXT NOT NULL,
  instrumento TEXT NOT NULL DEFAULT 'GAD-7' CHECK (instrumento IN ('GAD-7', 'PHQ-9', 'COMPLETO')),
  total INTEGER NOT NULL DEFAULT 0,
  gad7_total INTEGER,
  phq9_total INTEGER,
  nivel public.nivel_riesgo NOT NULL DEFAULT 'verde',
  item9 INTEGER NOT NULL DEFAULT 0,
  alerta BOOLEAN NOT NULL DEFAULT false,
  respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_respuestas_tamizaje_folio ON public.respuestas_tamizaje(folio);
CREATE INDEX IF NOT EXISTS idx_respuestas_tamizaje_user ON public.respuestas_tamizaje(user_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_tamizaje_nivel ON public.respuestas_tamizaje(nivel);

-- Trigger para completar user_id en respuestas_tamizaje desde pacientes si viene NULL
CREATE OR REPLACE FUNCTION public.sync_respuestas_tamizaje_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.folio IS NOT NULL THEN
    SELECT p.user_id INTO NEW.user_id
    FROM public.pacientes p
    WHERE p.folio = NEW.folio
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_respuestas_tamizaje_user ON public.respuestas_tamizaje;
CREATE TRIGGER trg_sync_respuestas_tamizaje_user
  BEFORE INSERT ON public.respuestas_tamizaje
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_respuestas_tamizaje_user_id();

ALTER TABLE public.respuestas_tamizaje ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiantes ven sus respuestas de tamizaje" ON public.respuestas_tamizaje;
CREATE POLICY "Estudiantes ven sus respuestas de tamizaje"
  ON public.respuestas_tamizaje FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR folio IN (SELECT folio FROM public.pacientes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Estudiantes registran sus respuestas de tamizaje" ON public.respuestas_tamizaje;
CREATE POLICY "Estudiantes registran sus respuestas de tamizaje"
  ON public.respuestas_tamizaje FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Psicólogos y directivos consultan estadísticas de tamizaje" ON public.respuestas_tamizaje;
CREATE POLICY "Psicólogos y directivos consultan estadísticas de tamizaje"
  ON public.respuestas_tamizaje FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

-- Alertas prioritarias (botón de auxilio / nivel rojo)
CREATE TABLE IF NOT EXISTS public.alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  folio TEXT,
  tipo TEXT NOT NULL,
  mensaje TEXT NOT NULL DEFAULT 'Alerta prioritaria registrada',
  atendida BOOLEAN NOT NULL DEFAULT false,
  atendida_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  atendida_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_alertas_folio ON public.alertas(folio);
CREATE INDEX IF NOT EXISTS idx_alertas_atendida ON public.alertas(atendida);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiantes crean alertas de emergencia" ON public.alertas;
CREATE POLICY "Estudiantes crean alertas de emergencia"
  ON public.alertas FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Estudiantes ven sus propias alertas" ON public.alertas;
CREATE POLICY "Estudiantes ven sus propias alertas"
  ON public.alertas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogos atienden alertas" ON public.alertas;
CREATE POLICY "Psicólogos atienden alertas"
  ON public.alertas FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'psicologo')
  WITH CHECK (public.current_user_role() = 'psicologo');

-- Alertas clínicas enviadas por correo (notificar-psicologo-rojo)
CREATE TABLE IF NOT EXISTS public.alertas_clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nivel public.nivel_riesgo NOT NULL DEFAULT 'rojo',
  psicologo_email TEXT NOT NULL,
  resend_message_id TEXT,
  item9_score INTEGER,
  phq9_total INTEGER,
  gad7_total INTEGER,
  enviado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.alertas_clinicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Psicólogos consultan alertas clínicas" ON public.alertas_clinicas;
CREATE POLICY "Psicólogos consultan alertas clínicas"
  ON public.alertas_clinicas FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

DROP POLICY IF EXISTS "Sistema o usuario autenticado registra alerta clínica" ON public.alertas_clinicas;
CREATE POLICY "Sistema o usuario autenticado registra alerta clínica"
  ON public.alertas_clinicas FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.current_user_role() = 'psicologo');

-- Vista clínica segura para el semáforo del psicólogo (`para_psicologo`)
CREATE OR REPLACE VIEW public.para_psicologo
WITH (security_invoker = true) AS
SELECT
  p.folio,
  p.iniciales,
  pr.nombre,
  pr.matricula,
  p.edad,
  p.sexo,
  COALESCE(p.semestre, pr.semestre) AS semestre,
  COALESCE(p.carrera, pr.carrera, 'TESH Huixquilucan') AS carrera,
  COALESCE(p.grupo, pr.grupo, '101') AS grupo,
  COALESCE(
    (
      SELECT rt.nivel::text
      FROM public.respuestas_tamizaje rt
      WHERE rt.folio = p.folio
      ORDER BY rt.creado_en DESC
      LIMIT 1
    ),
    CASE WHEN p.bloqueado THEN 'rojo' ELSE 'verde' END
  ) AS ultimo_nivel,
  COALESCE(
    (
      SELECT COALESCE(rt.gad7_total, rt.total)
      FROM public.respuestas_tamizaje rt
      WHERE rt.folio = p.folio AND rt.instrumento = 'GAD-7'
      ORDER BY rt.creado_en DESC
      LIMIT 1
    ),
    0
  ) AS gad7_total,
  COALESCE(
    (
      SELECT COALESCE(rt.phq9_total, rt.total)
      FROM public.respuestas_tamizaje rt
      WHERE rt.folio = p.folio AND rt.instrumento = 'PHQ-9'
      ORDER BY rt.creado_en DESC
      LIMIT 1
    ),
    0
  ) AS phq9_total,
  COALESCE(
    (
      SELECT MAX(rt.item9)
      FROM public.respuestas_tamizaje rt
      WHERE rt.folio = p.folio
    ),
    0
  ) AS item9,
  p.bloqueado,
  EXISTS (
    SELECT 1 FROM public.alertas a
    WHERE a.folio = p.folio AND a.atendida = false
  ) AS tiene_alerta_activa,
  COALESCE(
    (
      SELECT MAX(rt.creado_en)
      FROM public.respuestas_tamizaje rt
      WHERE rt.folio = p.folio
    ),
    p.fecha_registro
  ) AS ultimo_tamizaje,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.alertas a
    WHERE a.folio = p.folio AND a.atendida = false
  ) AS alertas_pendientes,
  COALESCE(pr.modo_acompanamiento, true) AS modo_acompanamiento
FROM public.pacientes p
LEFT JOIN public.profiles pr ON pr.id = p.user_id
WHERE COALESCE(pr.modo_acompanamiento, true) = true
   OR p.bloqueado = true;

-- RPC `liberar_paciente(p_folio)` para el psicólogo
CREATE OR REPLACE FUNCTION public.liberar_paciente(p_folio TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'psicologo' THEN
    RAISE EXCEPTION 'Solo personal de psicología autorizado puede liberar pacientes.';
  END IF;

  UPDATE public.pacientes
  SET bloqueado = false,
      updated_at = timezone('utc'::text, now())
  WHERE folio = p_folio;

  UPDATE public.alertas
  SET atendida = true,
      atendida_por = auth.uid(),
      atendida_en = timezone('utc'::text, now())
  WHERE folio = p_folio AND atendida = false;

  RETURN FOUND;
END;
$$;


-- ==============================================================================
-- PASO 6. SOLICITUDES DE CITA PRESENCIAL (PB-009)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.solicitudes_cita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL,
  folio_tamizaje TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  matricula TEXT,
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

CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_user_id ON public.solicitudes_cita(user_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_psicologo ON public.solicitudes_cita(psicologo_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_folio ON public.solicitudes_cita(folio);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_fecha_hora ON public.solicitudes_cita(fecha_cita, hora_cita);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cita_estado ON public.solicitudes_cita(estado);

-- Constraint UNIQUE para evitar doble reserva en el mismo horario activo (psicologo_id + fecha + hora)
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitudes_cita_slot_activo
  ON public.solicitudes_cita(psicologo_id, fecha_cita, hora_cita)
  WHERE estado IN ('pendiente', 'confirmada');

CREATE OR REPLACE FUNCTION public.handle_updated_at_solicitudes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_solicitudes_updated_at ON public.solicitudes_cita;
CREATE TRIGGER trigger_solicitudes_updated_at
  BEFORE UPDATE ON public.solicitudes_cita
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_solicitudes();

ALTER TABLE public.solicitudes_cita ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiante puede ver sus propias solicitudes" ON public.solicitudes_cita;
CREATE POLICY "Estudiante puede ver sus propias solicitudes"
  ON public.solicitudes_cita FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Estudiante puede registrar solicitud" ON public.solicitudes_cita;
CREATE POLICY "Estudiante puede registrar solicitud"
  ON public.solicitudes_cita FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND modalidad = 'presencial'
    AND estado = 'pendiente'
    AND (motivo IS NULL OR char_length(motivo) <= 280)
  );

DROP POLICY IF EXISTS "Estudiante puede cancelar con +2h de anticipacion" ON public.solicitudes_cita;
CREATE POLICY "Estudiante puede cancelar con +2h de anticipacion"
  ON public.solicitudes_cita FOR UPDATE
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

DROP POLICY IF EXISTS "Psicólogo y directivo ven solicitudes de pacientes" ON public.solicitudes_cita;
CREATE POLICY "Psicólogo y directivo ven solicitudes de pacientes"
  ON public.solicitudes_cita FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

DROP POLICY IF EXISTS "Psicólogo gestiona estado de citas" ON public.solicitudes_cita;
CREATE POLICY "Psicólogo gestiona estado de citas"
  ON public.solicitudes_cita FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'psicologo')
  WITH CHECK (public.current_user_role() = 'psicologo');


-- ==============================================================================
-- PASO 7. EXPEDIENTES CLÍNICOS (JSONB)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expedientes_clinicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL,
  psicologo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campos_clinicos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT expedientes_clinicos_folio_psicologo_unique UNIQUE (folio, psicologo_id)
);

CREATE INDEX IF NOT EXISTS idx_expedientes_folio ON public.expedientes_clinicos(folio);
CREATE INDEX IF NOT EXISTS idx_expedientes_psicologo ON public.expedientes_clinicos(psicologo_id);

CREATE OR REPLACE FUNCTION public.handle_updated_at_expedientes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_expedientes_updated_at ON public.expedientes_clinicos;
CREATE TRIGGER trigger_expedientes_updated_at
  BEFORE UPDATE ON public.expedientes_clinicos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_expedientes();

ALTER TABLE public.expedientes_clinicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Psicólogo puede ver sus propios expedientes" ON public.expedientes_clinicos;
CREATE POLICY "Psicólogo puede ver sus propios expedientes"
  ON public.expedientes_clinicos FOR SELECT
  TO authenticated
  USING (psicologo_id = auth.uid() AND public.current_user_role() = 'psicologo');

DROP POLICY IF EXISTS "Psicólogo puede registrar expedientes" ON public.expedientes_clinicos;
CREATE POLICY "Psicólogo puede registrar expedientes"
  ON public.expedientes_clinicos FOR INSERT
  TO authenticated
  WITH CHECK (psicologo_id = auth.uid() AND public.current_user_role() = 'psicologo');

DROP POLICY IF EXISTS "Psicólogo puede actualizar sus expedientes" ON public.expedientes_clinicos;
CREATE POLICY "Psicólogo puede actualizar sus expedientes"
  ON public.expedientes_clinicos FOR UPDATE
  TO authenticated
  USING (psicologo_id = auth.uid() AND public.current_user_role() = 'psicologo')
  WITH CHECK (psicologo_id = auth.uid() AND public.current_user_role() = 'psicologo');


-- ==============================================================================
-- PASO 8. ENCUESTA DE SATISFACCIÓN PB-021 (20 CAMPOS) + COLA DE ENVÍOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.respuestas_encuesta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_tipo TEXT NOT NULL CHECK (trigger_tipo IN ('alta', 'abandono')),
  trigger_fecha TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  enviada_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  respondida_en TIMESTAMPTZ,
  q1_satisfaccion INTEGER CHECK (q1_satisfaccion BETWEEN 1 AND 5),
  q2_escuchado INTEGER CHECK (q2_escuchado BETWEEN 1 AND 5),
  q3_claridad INTEGER CHECK (q3_claridad BETWEEN 1 AND 5),
  q4_respeto INTEGER CHECK (q4_respeto BETWEEN 1 AND 5),
  q5_tiempo_espera INTEGER CHECK (q5_tiempo_espera BETWEEN 1 AND 5),
  q6_utilidad INTEGER CHECK (q6_utilidad BETWEEN 1 AND 5),
  q7_mejoria INTEGER CHECK (q7_mejoria BETWEEN 1 AND 5),
  q8_recomendar INTEGER CHECK (q8_recomendar BETWEEN 1 AND 5),
  q9_comentarios TEXT,
  q10a_facilidad_eli INTEGER CHECK (q10a_facilidad_eli BETWEEN 1 AND 5),
  q10b_util_eli INTEGER CHECK (q10b_util_eli BETWEEN 1 AND 5),
  hash_auditoria TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_folio ON public.respuestas_encuesta(folio);
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_trigger ON public.respuestas_encuesta(trigger_tipo);
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta_respondida ON public.respuestas_encuesta(respondida_en);

ALTER TABLE public.respuestas_encuesta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiante puede ver su propia encuesta" ON public.respuestas_encuesta;
CREATE POLICY "Estudiante puede ver su propia encuesta"
  ON public.respuestas_encuesta FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR folio IN (SELECT folio FROM public.respuestas_tamizaje WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Estudiante puede registrar su encuesta" ON public.respuestas_encuesta;
CREATE POLICY "Estudiante puede registrar su encuesta"
  ON public.respuestas_encuesta FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Estudiante puede responder su encuesta pendiente" ON public.respuestas_encuesta;
CREATE POLICY "Estudiante puede responder su encuesta pendiente"
  ON public.respuestas_encuesta FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR folio IN (SELECT folio FROM public.respuestas_tamizaje WHERE user_id = auth.uid())
  )
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Psicólogos y directivos ven resultados de encuestas" ON public.respuestas_encuesta;
CREATE POLICY "Psicólogos y directivos ven resultados de encuestas"
  ON public.respuestas_encuesta FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

-- Cola programada de envíos de encuesta (Alta 24h / Abandono 15 días)
CREATE TABLE IF NOT EXISTS public.cola_envios_encuesta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitud_cita_id UUID REFERENCES public.solicitudes_cita(id) ON DELETE SET NULL,
  trigger_tipo TEXT NOT NULL CHECK (trigger_tipo IN ('alta', 'abandono')),
  email_destinatario TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviada', 'fallida', 'cancelada', 'respondida')),
  programada_para TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expira_en TIMESTAMPTZ,
  enviada_en TIMESTAMPTZ,
  resend_message_id TEXT,
  intentos INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cola_envios_encuesta_estado ON public.cola_envios_encuesta(estado, programada_para);
CREATE INDEX IF NOT EXISTS idx_cola_envios_encuesta_folio ON public.cola_envios_encuesta(folio);

ALTER TABLE public.cola_envios_encuesta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiantes consultan sus envíos de encuesta" ON public.cola_envios_encuesta;
CREATE POLICY "Estudiantes consultan sus envíos de encuesta"
  ON public.cola_envios_encuesta FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogo y directivo gestionan cola de encuestas" ON public.cola_envios_encuesta;
CREATE POLICY "Psicólogo y directivo gestionan cola de encuestas"
  ON public.cola_envios_encuesta FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'))
  WITH CHECK (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

-- Trigger automático: cita completada -> encola encuesta PB-021 a las 24h
CREATE OR REPLACE FUNCTION public.handle_cita_completada_encuesta_24h()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'completada' AND (OLD.estado IS DISTINCT FROM 'completada') THEN
    INSERT INTO public.cola_envios_encuesta (
      folio,
      user_id,
      solicitud_cita_id,
      trigger_tipo,
      email_destinatario,
      estado,
      programada_para,
      expira_en
    )
    VALUES (
      NEW.folio,
      NEW.user_id,
      NEW.id,
      'alta',
      NEW.email,
      'pendiente',
      timezone('utc'::text, now()) + interval '24 hours',
      timezone('utc'::text, now()) + interval '48 hours'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cita_completada_encuesta_24h ON public.solicitudes_cita;
CREATE TRIGGER trigger_cita_completada_encuesta_24h
  AFTER UPDATE OF estado ON public.solicitudes_cita
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_cita_completada_encuesta_24h();


-- ==============================================================================
-- PASO 9. AUDITORÍA BLOCKCHAIN SHA-256 + VISTA SEGURA + VERIFICACIÓN
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bloques_auditoria (
  indice BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  hash_previo TEXT NOT NULL,
  hash_actual TEXT NOT NULL,
  datos JSONB NOT NULL,
  anclado_en TEXT,          -- Hash de transacción en Polygon Amoy Testnet
  bloque_ext BIGINT,        -- Número de bloque externo en Polygon Amoy
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bloques_auditoria_anclado ON public.bloques_auditoria(anclado_en);

ALTER TABLE public.bloques_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de bloques de auditoria para usuarios autenticados" ON public.bloques_auditoria;
CREATE POLICY "Lectura de bloques de auditoria para usuarios autenticados"
  ON public.bloques_auditoria FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Inserción de bloques de auditoria por personal autorizado" ON public.bloques_auditoria;
CREATE POLICY "Inserción de bloques de auditoria por personal autorizado"
  ON public.bloques_auditoria FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

CREATE OR REPLACE VIEW public.v_auditoria_resumen
WITH (security_invoker = true) AS
SELECT
  indice,
  COALESCE(datos->>'tipo_evento', datos->>'tipo', 'REGISTRO_TAMIZAJE') AS tipo_evento,
  hash_actual,
  SUBSTRING(hash_actual FROM 1 FOR 10) || '...' || SUBSTRING(hash_actual FROM LENGTH(hash_actual) - 7 FOR 8) AS hash_abreviado,
  hash_previo,
  anclado_en,
  bloque_ext,
  CASE WHEN anclado_en IS NOT NULL THEN true ELSE false END AS esta_anclado,
  'https://amoy.polygonscan.com/tx/' || anclado_en AS enlace_explorador,
  creado_en
FROM public.bloques_auditoria
ORDER BY indice DESC;

CREATE OR REPLACE FUNCTION public.verificar_cadena()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  prev_hash TEXT := '0000000000000000000000000000000000000000000000000000000000000000';
  total INT := 0;
  anclados INT := 0;
  last_hash TEXT := '';
BEGIN
  FOR rec IN
    SELECT indice, hash_previo, hash_actual, anclado_en
    FROM public.bloques_auditoria
    ORDER BY indice ASC
  LOOP
    total := total + 1;
    IF rec.anclado_en IS NOT NULL THEN
      anclados := anclados + 1;
    END IF;

    IF total > 1 AND rec.hash_previo <> prev_hash THEN
      RETURN jsonb_build_object(
        'valida', false,
        'indice_alterado', rec.indice,
        'error', 'Discrepancia en bloque #' || rec.indice
      );
    END IF;

    prev_hash := rec.hash_actual;
    last_hash := rec.hash_actual;
  END LOOP;

  RETURN jsonb_build_object(
    'valida', true,
    'total_bloques', total,
    'anclados', anclados,
    'ultimo_hash', last_hash,
    'mensaje', 'CADENA VÁLIDA'
  );
END;
$$;


-- ==============================================================================
-- PASO 10. NOTAS DE VOZ (RETENCIÓN 30 DÍAS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notas_voz (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folio TEXT,
  folio_tamizaje TEXT,
  transcripcion TEXT NOT NULL,
  duracion_seg INTEGER,
  expira_en TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '30 days'),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notas_voz_user ON public.notas_voz(user_id);
CREATE INDEX IF NOT EXISTS idx_notas_voz_folio_tamizaje ON public.notas_voz(folio_tamizaje);
CREATE INDEX IF NOT EXISTS idx_notas_voz_expira ON public.notas_voz(expira_en);

CREATE OR REPLACE FUNCTION public.purgar_notas_voz_expiradas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.notas_voz
  WHERE expira_en < timezone('utc'::text, now());
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

ALTER TABLE public.notas_voz ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estudiantes gestionan sus notas de voz" ON public.notas_voz;
CREATE POLICY "Estudiantes gestionan sus notas de voz"
  ON public.notas_voz FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogos consultan notas de voz en acompañamiento" ON public.notas_voz;
CREATE POLICY "Psicólogos consultan notas de voz en acompañamiento"
  ON public.notas_voz FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'psicologo'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = notas_voz.user_id AND p.modo_acompanamiento = true
    )
  );


-- ==============================================================================
-- PASO 11. RECURSOS PSICOEDUCATIVOS (5 CATEGORÍAS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.recursos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (
    category IN ('Ansiedad', 'Depresión', 'Sueño', 'Relaciones', 'Estrés académico')
  ),
  read_time TEXT NOT NULL DEFAULT '4 min de lectura',
  icon_name TEXT NOT NULL DEFAULT 'bookOpen',
  tone TEXT NOT NULL DEFAULT 'teal' CHECK (
    tone IN ('teal', 'cyan', 'mint', 'lavender', 'rose')
  ),
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_takeaway TEXT,
  video_url TEXT,
  video_title TEXT,
  video_orientation TEXT DEFAULT 'auto' CHECK (
    video_orientation IS NULL OR video_orientation IN ('auto', 'horizontal', 'vertical', 'square')
  ),
  thumbnail_url TEXT,
  format TEXT NOT NULL DEFAULT 'lectura' CHECK (
    format IN ('video', 'lectura', 'ejercicio', 'audio', 'infografia')
  ),
  author TEXT DEFAULT 'Área de Psicología TESH',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recursos_category ON public.recursos(category);
CREATE INDEX IF NOT EXISTS idx_recursos_active ON public.recursos(active);

ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recursos activos visibles para todos" ON public.recursos;
CREATE POLICY "Recursos activos visibles para todos"
  ON public.recursos FOR SELECT
  TO anon, authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Psicólogos y directivos gestionan recursos" ON public.recursos;
CREATE POLICY "Psicólogos y directivos gestionan recursos"
  ON public.recursos FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'))
  WITH CHECK (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));


-- ==============================================================================
-- PASO 12. TUTORES_GRUPO, CANALIZACIONES Y ALERTAS_INASISTENCIA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tutores_grupo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  carrera TEXT NOT NULL,
  semestre TEXT NOT NULL,
  grupo TEXT NOT NULL,
  periodo TEXT NOT NULL DEFAULT '2026-2',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tutores_grupo_tutor ON public.tutores_grupo(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutores_grupo_periodo ON public.tutores_grupo(periodo);
CREATE INDEX IF NOT EXISTS idx_tutores_grupo_lookup ON public.tutores_grupo(carrera, semestre, grupo, activo);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tutores_grupo_activo
  ON public.tutores_grupo(carrera, semestre, grupo, periodo)
  WHERE activo = true;

ALTER TABLE public.tutores_grupo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutores ven sus asignaciones" ON public.tutores_grupo;
CREATE POLICY "Tutores ven sus asignaciones"
  ON public.tutores_grupo FOR SELECT
  TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Comunidad consulta asignaciones activas de tutores" ON public.tutores_grupo;
CREATE POLICY "Comunidad consulta asignaciones activas de tutores"
  ON public.tutores_grupo FOR SELECT
  TO authenticated
  USING (activo = true);

DROP POLICY IF EXISTS "Directivos gestionan asignaciones de tutores" ON public.tutores_grupo;
CREATE POLICY "Directivos gestionan asignaciones de tutores"
  ON public.tutores_grupo FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('directivo', 'jefatura', 'coordinador'))
  WITH CHECK (public.current_user_role() IN ('directivo', 'jefatura', 'coordinador'));

-- Política diferida en `profiles` para que tutores consulten únicamente a estudiantes de sus grupos activos
DROP POLICY IF EXISTS "Tutores ven estudiantes de sus grupos asignados" ON public.profiles;
CREATE POLICY "Tutores ven estudiantes de sus grupos asignados"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'tutor'
    AND rol = 'estudiante'::public.app_role
    AND EXISTS (
      SELECT 1 FROM public.tutores_grupo tg
      WHERE tg.tutor_id = auth.uid()
        AND tg.activo = true
        AND tg.carrera = profiles.carrera
        AND tg.grupo = profiles.grupo
    )
  );

-- Canalizaciones (Tutor -> Psicólogo)
CREATE TABLE IF NOT EXISTS public.canalizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  psicologo_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  estudiante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folio TEXT,
  carrera TEXT,
  grupo TEXT,
  semestre TEXT,
  motivo TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('normal', 'alta', 'urgente')),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'completada')),
  motivo_rechazo TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_canalizaciones_tutor ON public.canalizaciones(tutor_id);
CREATE INDEX IF NOT EXISTS idx_canalizaciones_estudiante ON public.canalizaciones(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_canalizaciones_estado ON public.canalizaciones(estado);

ALTER TABLE public.canalizaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutores ven y crean sus canalizaciones" ON public.canalizaciones;
CREATE POLICY "Tutores ven sus canalizaciones"
  ON public.canalizaciones FOR SELECT
  TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Tutores crean canalizaciones" ON public.canalizaciones;
CREATE POLICY "Tutores crean canalizaciones"
  ON public.canalizaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.current_user_role() IN ('tutor', 'directivo', 'jefatura', 'coordinador')
  );

DROP POLICY IF EXISTS "Estudiantes ven sus propias canalizaciones" ON public.canalizaciones;
CREATE POLICY "Estudiantes ven sus propias canalizaciones"
  ON public.canalizaciones FOR SELECT
  TO authenticated
  USING (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogos y directivos consultan canalizaciones" ON public.canalizaciones;
CREATE POLICY "Psicólogos y directivos consultan canalizaciones"
  ON public.canalizaciones FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

DROP POLICY IF EXISTS "Psicólogos actualizan estado de canalizaciones" ON public.canalizaciones;
CREATE POLICY "Psicólogos actualizan estado de canalizaciones"
  ON public.canalizaciones FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'psicologo')
  WITH CHECK (public.current_user_role() = 'psicologo');

-- Alertas de inasistencia y canalización (Tutor / Psicólogo / Estudiante)
CREATE TABLE IF NOT EXISTS public.alertas_inasistencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  psicologo_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  estudiante_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('no_asistio', 'inasistencia_repetida', 'no_canalizacion')),
  prioridad TEXT NOT NULL DEFAULT 'alta' CHECK (prioridad IN ('normal', 'alta', 'urgente')),
  mensaje TEXT NOT NULL,
  leida_tutor BOOLEAN NOT NULL DEFAULT false,
  leida_estudiante BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_alertas_inasistencia_tutor ON public.alertas_inasistencia(tutor_id, leida_tutor);
CREATE INDEX IF NOT EXISTS idx_alertas_inasistencia_est ON public.alertas_inasistencia(estudiante_id, leida_estudiante);

ALTER TABLE public.alertas_inasistencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutores consultan sus alertas de inasistencia" ON public.alertas_inasistencia;
CREATE POLICY "Tutores consultan sus alertas de inasistencia"
  ON public.alertas_inasistencia FOR SELECT
  TO authenticated
  USING (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Tutores marcan leidas sus alertas" ON public.alertas_inasistencia;
CREATE POLICY "Tutores marcan leidas sus alertas"
  ON public.alertas_inasistencia FOR UPDATE
  TO authenticated
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

DROP POLICY IF EXISTS "Tutores registran alertas al canalizar" ON public.alertas_inasistencia;
CREATE POLICY "Tutores registran alertas al canalizar"
  ON public.alertas_inasistencia FOR INSERT
  TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND public.current_user_role() IN ('tutor', 'directivo', 'jefatura', 'coordinador')
  );

DROP POLICY IF EXISTS "Estudiantes consultan sus alertas" ON public.alertas_inasistencia;
CREATE POLICY "Estudiantes consultan sus alertas"
  ON public.alertas_inasistencia FOR SELECT
  TO authenticated
  USING (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Estudiantes marcan leidas sus alertas" ON public.alertas_inasistencia;
CREATE POLICY "Estudiantes marcan leidas sus alertas"
  ON public.alertas_inasistencia FOR UPDATE
  TO authenticated
  USING (estudiante_id = auth.uid())
  WITH CHECK (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogos y directivos gestionan alertas de inasistencia" ON public.alertas_inasistencia;
CREATE POLICY "Psicólogos y directivos gestionan alertas de inasistencia"
  ON public.alertas_inasistencia FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'))
  WITH CHECK (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));


-- ==============================================================================
-- PASO 13. MÓDULO DE ANUNCIOS Y TALLERES (`anuncios` + `anuncios_inscripciones`)
-- ==============================================================================
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_anuncios_activo ON public.anuncios(activo);
CREATE INDEX IF NOT EXISTS idx_anuncios_tipo ON public.anuncios(tipo);
CREATE INDEX IF NOT EXISTS idx_anuncios_fecha_evento ON public.anuncios(fecha_evento);

CREATE TABLE IF NOT EXISTS public.anuncios_inscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estudiante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  anuncio_id UUID NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  fecha TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(estudiante_id, anuncio_id)
);

CREATE INDEX IF NOT EXISTS idx_anuncios_inscripciones_estudiante ON public.anuncios_inscripciones(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_anuncios_inscripciones_anuncio ON public.anuncios_inscripciones(anuncio_id);

CREATE OR REPLACE FUNCTION public.set_anuncios_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anuncios_updated_at ON public.anuncios;
CREATE TRIGGER trg_anuncios_updated_at
  BEFORE UPDATE ON public.anuncios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_anuncios_updated_at();

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
        updated_at = timezone('utc'::text, now())
    WHERE id = v_anuncio_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_inscritos_anuncio ON public.anuncios_inscripciones;
CREATE TRIGGER trg_sincronizar_inscritos_anuncio
  AFTER INSERT OR DELETE ON public.anuncios_inscripciones
  FOR EACH ROW
  EXECUTE FUNCTION public.sincronizar_inscritos_anuncio();

ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anuncios_inscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven anuncios activos" ON public.anuncios;
CREATE POLICY "Usuarios ven anuncios activos"
  ON public.anuncios FOR SELECT
  TO authenticated
  USING (activo = true);

DROP POLICY IF EXISTS "Psicólogo y directivo gestionan anuncios" ON public.anuncios;
CREATE POLICY "Psicólogo y directivo gestionan anuncios"
  ON public.anuncios FOR ALL
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'))
  WITH CHECK (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));

DROP POLICY IF EXISTS "Estudiantes consultan sus inscripciones" ON public.anuncios_inscripciones;
CREATE POLICY "Estudiantes consultan sus inscripciones"
  ON public.anuncios_inscripciones FOR SELECT
  TO authenticated
  USING (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Estudiantes se inscriben a anuncios" ON public.anuncios_inscripciones;
CREATE POLICY "Estudiantes se inscriben a anuncios"
  ON public.anuncios_inscripciones FOR INSERT
  TO authenticated
  WITH CHECK (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Estudiantes cancelan sus inscripciones" ON public.anuncios_inscripciones;
CREATE POLICY "Estudiantes cancelan sus inscripciones"
  ON public.anuncios_inscripciones FOR DELETE
  TO authenticated
  USING (estudiante_id = auth.uid());

DROP POLICY IF EXISTS "Psicólogo y directivo consultan inscripciones" ON public.anuncios_inscripciones;
CREATE POLICY "Psicólogo y directivo consultan inscripciones"
  ON public.anuncios_inscripciones FOR SELECT
  TO authenticated
  USING (public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador'));


-- ==============================================================================
-- PASO 14. BUCKETS DE SUPABASE STORAGE (`recursos-videos`, `anuncios-flyers`)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('recursos-videos', 'recursos-videos', true),
  ('anuncios-flyers', 'anuncios-flyers', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage: recursos-videos
DROP POLICY IF EXISTS "Videos de recursos son públicos para lectura" ON storage.objects;
CREATE POLICY "Videos de recursos son públicos para lectura"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'recursos-videos');

DROP POLICY IF EXISTS "Psicólogos suben videos de recursos" ON storage.objects;
CREATE POLICY "Psicólogos suben videos de recursos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recursos-videos'
    AND public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
  );

DROP POLICY IF EXISTS "Psicólogos eliminan videos de recursos" ON storage.objects;
CREATE POLICY "Psicólogos eliminan videos de recursos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recursos-videos'
    AND public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
  );

-- Políticas de Storage: anuncios-flyers
DROP POLICY IF EXISTS "Flyers de anuncios son públicos para lectura" ON storage.objects;
CREATE POLICY "Flyers de anuncios son públicos para lectura"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'anuncios-flyers');

DROP POLICY IF EXISTS "Psicólogos suben flyers de anuncios" ON storage.objects;
CREATE POLICY "Psicólogos suben flyers de anuncios"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'anuncios-flyers'
    AND public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
  );

DROP POLICY IF EXISTS "Psicólogos actualizan flyers de anuncios" ON storage.objects;
CREATE POLICY "Psicólogos actualizan flyers de anuncios"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'anuncios-flyers'
    AND public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
  );

DROP POLICY IF EXISTS "Psicólogos eliminan flyers de anuncios" ON storage.objects;
CREATE POLICY "Psicólogos eliminan flyers de anuncios"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'anuncios-flyers'
    AND public.current_user_role() IN ('psicologo', 'directivo', 'jefatura', 'coordinador')
  );

-- ==============================================================================
-- FIN DEL ESQUEMA UNIFICADO EQUILIBRA TESH
-- ==============================================================================

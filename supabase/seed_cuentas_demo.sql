-- ==============================================================================
-- EQUILIBRA TESH — SEED DE 6 CUENTAS DEMO REALES EN SUPABASE AUTH + PROFILES
-- ==============================================================================
-- Contraseña para TODAS las cuentas: password123
--
-- Cuentas que crea (idempotente, no falla si ya existen):
--   1. dess@tesh.mx           -> rol: 'estudiante'
--   2. dra.marta@tesh.mx      -> rol: 'psicologo'
--   3. tutor@tesh.mx          -> rol: 'tutor' (+ asignación al grupo 501 ISC)
--   4. demo-jefatura@tesh.mx  -> rol: 'jefatura'
--   5. demo-medico@tesh.mx    -> rol: 'medico'
--   6. directivo@tesh.mx      -> rol: 'directivo'
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- Pausar temporalmente los triggers de usuario en `profiles` (ej. `bloquear_cambio_rol()`)
-- únicamente durante este seed administrativo dentro de la transacción.
ALTER TABLE public.profiles DISABLE TRIGGER USER;

DO $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_password_hash TEXT;
  v_user_id UUID;
  v_rec RECORD;
BEGIN
  -- Generar hash bcrypt compatible con GoTrue usando pgcrypto (soporta esquema public o extensions)
  BEGIN
    v_password_hash := extensions.crypt('password123', extensions.gen_salt('bf'));
  EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
    v_password_hash := crypt('password123', gen_salt('bf'));
  END;

  FOR v_rec IN
    SELECT * FROM (
      VALUES
        (
          '11111111-1111-4111-8111-111111111101'::uuid,
          'dess@tesh.mx',
          'Dess Bautista',
          '202310452',
          'Ing. en Sistemas Computacionales',
          '5',
          '501',
          'estudiante'::public.app_role
        ),
        (
          '11111111-1111-4111-8111-111111111102'::uuid,
          'dra.marta@tesh.mx',
          'Dra. Marta Gómez',
          'PSI-88410',
          'Área de Psicología',
          NULL,
          NULL,
          'psicologo'::public.app_role
        ),
        (
          '11111111-1111-4111-8111-111111111103'::uuid,
          'tutor@tesh.mx',
          'Mtro. Carlos Mendoza',
          'TUT-50101',
          'Ing. en Sistemas Computacionales',
          '5',
          '501',
          'tutor'::public.app_role
        ),
        (
          '11111111-1111-4111-8111-111111111104'::uuid,
          'demo-jefatura@tesh.mx',
          'Mtra. Patricia Hernández',
          'JEF-44102',
          'Jefatura de Carrera y Tutorías',
          NULL,
          NULL,
          'jefatura'::public.app_role
        ),
        (
          '11111111-1111-4111-8111-111111111105'::uuid,
          'demo-medico@tesh.mx',
          'Dr. Alejandro Vega',
          'MED-70210',
          'Servicio Médico Universitario TESH',
          NULL,
          NULL,
          'medico'::public.app_role
        ),
        (
          '11111111-1111-4111-8111-111111111106'::uuid,
          'directivo@tesh.mx',
          'Mtro. Roberto Albarrán',
          'DIR-33201',
          'Dirección Académica',
          NULL,
          NULL,
          'directivo'::public.app_role
        )
    ) AS t(uid, email, nombre, matricula, carrera, semestre, grupo, rol)
  LOOP
    -- Buscar si ya existe por correo en auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(email) = lower(v_rec.email)
    LIMIT 1;

    IF v_user_id IS NULL THEN
      v_user_id := v_rec.uid;

      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_user_id,
        'authenticated',
        'authenticated',
        v_rec.email,
        v_password_hash,
        v_now,
        '',
        '',
        '',
        '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'nombre', v_rec.nombre,
          'matricula', v_rec.matricula,
          'carrera', v_rec.carrera,
          'semestre', COALESCE(v_rec.semestre, ''),
          'grupo', COALESCE(v_rec.grupo, '')
        ),
        v_now,
        v_now
      );

      INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_rec.email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        v_now,
        v_now,
        v_now
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Asegurar perfil con su rol exacto en public.profiles
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
      role,
      aviso_privacidad_aceptado,
      aviso_privacidad_version,
      aviso_privacidad_fecha
    )
    VALUES (
      v_user_id,
      v_rec.nombre,
      v_rec.nombre,
      v_rec.email,
      v_rec.matricula,
      v_rec.carrera,
      v_rec.semestre,
      v_rec.grupo,
      v_rec.rol,
      v_rec.rol,
      true,
      '2026-v1',
      v_now
    )
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      name = EXCLUDED.name,
      matricula = EXCLUDED.matricula,
      carrera = EXCLUDED.carrera,
      semestre = EXCLUDED.semestre,
      grupo = EXCLUDED.grupo,
      rol = EXCLUDED.rol,
      role = EXCLUDED.role,
      aviso_privacidad_aceptado = true,
      updated_at = v_now;
  END LOOP;

  -- Asignar el grupo 501 de ISC al tutor demo para pruebas del módulo /tutor
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'tutor@tesh.mx' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.tutores_grupo (tutor_id, carrera, semestre, grupo, periodo, activo)
    VALUES (
      v_user_id,
      'Ing. en Sistemas Computacionales',
      '5',
      '501',
      '2026-2',
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;

ALTER TABLE public.profiles ENABLE TRIGGER USER;

COMMIT;

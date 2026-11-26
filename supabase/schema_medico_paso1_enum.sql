-- ==============================================================================
-- EQUILIBRA TESH — MIGRACIÓN DE ROLES (PASO 1 DE 2)
-- ==============================================================================
-- ⚠️ EJECUTAR ESTE ARCHIVO SOLO PRIMERO Y ESPERAR "Success" ⚠️
--
-- PostgreSQL prohíbe usar valores recién añadidos con `ALTER TYPE ... ADD VALUE`
-- en la MISMA transacción donde otras sentencias SQL o políticas RLS los
-- referencian (error 55P04).
--
-- Pasos recomendados en Supabase SQL Editor:
--   1) Pega y ejecuta únicamente este archivo (`schema_medico_paso1_enum.sql`).
--   2) Confirma que finalizó con "Success" (commit confirmado).
--   3) A continuación ejecuta `schema_completo.sql` (si faltan tablas/columnas)
--      o `schema_medico_paso2_rls.sql`.
-- ==============================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'jefatura';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordinador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'directivo';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tutor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'medico';

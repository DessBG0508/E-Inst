export type CattellFactorCode =
  "A" | "B" | "C" | "E" | "F" | "G" | "H" | "I" | "L" | "M" | "N" | "O" | "Q1" | "Q2" | "Q3" | "Q4";

export type CattellGlobalCode = "EXT" | "ANS" | "DUR" | "IND" | "AUT";

export type CattellOption = "A" | "B" | "C";

export type EstadoEvaluacionCattell = "pendiente" | "en_progreso" | "completado";

export type DictamenCattell = "pendiente" | "apto" | "apto_con_observaciones" | "no_apto";

export type PreRecomendacionCattell = "apto" | "apto_con_observaciones" | "no_apto";

export interface CattellFactorMeta {
  code: CattellFactorCode;
  name: string;
  lowPole: string;
  highPole: string;
  dualRelevance: string;
}

export interface CattellGlobalMeta {
  code: CattellGlobalCode;
  name: string;
  description: string;
}

export interface CattellItem {
  numero: number;
  factor: CattellFactorCode;
  enunciado: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  /** Opción que aporta 2 puntos al polo alto del factor (en factor B es la respuesta correcta). */
  keyedOption: "A" | "C";
  /** Si es verdadero, la opción intermedia B vale 0 puntos (ítems de razonamiento B). */
  strictBinary?: boolean;
}

export interface ConvocatoriaDual {
  id: string;
  nombre: string;
  periodo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  activa: boolean;
  creado_por: string | null;
  created_at: string;
}

export interface EstudianteDualOption {
  id: string;
  nombre: string;
  email: string;
  matricula: string | null;
  carrera: string | null;
  semestre: string | null;
  grupo: string | null;
}

export interface EvaluacionCattellRecord {
  id: string;
  convocatoria_id: string;
  convocatoria_nombre?: string;
  convocatoria_periodo?: string;
  convocatoria_fecha_limite?: string | null;
  estudiante_id: string;
  estudiante_nombre: string;
  estudiante_email: string;
  estudiante_matricula: string | null;
  estudiante_carrera: string | null;
  estudiante_semestre: string | null;
  estudiante_grupo: string | null;
  token_acceso: string;
  estado: EstadoEvaluacionCattell;
  total_reactivos: number;
  reactivos_respondidos: number;
  puntajes_brutos: Partial<Record<CattellFactorCode, number>>;
  puntajes_decatipos: Partial<Record<CattellFactorCode, number>>;
  factores_globales: Partial<Record<CattellGlobalCode, number>>;
  pre_recomendacion: PreRecomendacionCattell | null;
  dictamen: DictamenCattell;
  observaciones_psicologo: string | null;
  fecha_envio: string;
  fecha_inicio: string | null;
  fecha_completado: string | null;
  fecha_dictamen: string | null;
}

export interface RespuestaCattellInput {
  numero_pregunta: number;
  factor_codigo: CattellFactorCode;
  opcion: CattellOption;
  puntos: number;
}

export interface CattellConteoStats {
  totalHabilitados: number;
  pendientes: number;
  enProgreso: number;
  completados: number;
  dictamenPendiente: number;
  aptos: number;
  aptoConObservaciones: number;
  noAptos: number;
}

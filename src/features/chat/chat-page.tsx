import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import {
  History,
  RotateCcw,
  Plus,
  ChevronRight,
  Send,
  ShieldAlert,
  Phone,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Copy,
  Ticket,
  Mic,
  Stethoscope,
  Brain,
} from "lucide-react";
import { StudentTopBar } from "@/components/layout/student-top-bar";
import { VoiceNoteRecorder } from "@/components/chat/voice-note-recorder";
import {
  resetBackendScreeningState,
  persistTamizajeToSupabase,
  type EliMessage,
  type TamizajeSubmissionPayload,
} from "@/lib/api-client";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/mock-data";
import {
  INITIAL_SCREENING_STATE,
  ELI_WELCOME_MESSAGE,
  type ScreeningState,
  type ScreeningNivel,
  type EliPrefillPatient,
  processEliMessage,
  generateFolio,
  parseLikertOption,
  CRISIS_MESSAGE,
  detectCrisisKeywords,
  evaluateTriajeFromScreening,
  computeInitialsFromName,
  getTodayMexicoDateString,
} from "@/lib/eli-screening";
import { sanitizeText } from "@/lib/security";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/branding";
import { brandConfig } from "@/config/brand-config";
import { notificarTutorNivelRojo } from "@/features/tutor/tutor-service";
import {
  getChatSessionsStorageKey,
  getActiveSessionStorageKey,
  getStoredUserFolio,
  setStoredUserFolio,
  removeStoredUserFolio,
  clearLegacyUnscopedScreeningData,
} from "@/lib/screening-storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BreathingModal } from "@/features/bienestar/breathing-modal";
import { ChatSidePanel } from "./components/chat-side-panel";
import { GroundingModal } from "./components/grounding-modal";

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
  messages: EliMessage[];
  screeningState: ScreeningState;
}

if (typeof window !== "undefined") {
  clearLegacyUnscopedScreeningData();
}

function ensureSessionHasWelcome(session: ChatSession): ChatSession {
  if (!session.messages || session.messages.length === 0) {
    const welcomeMsg: EliMessage = {
      id: crypto.randomUUID(),
      sender: "eli",
      text: ELI_WELCOME_MESSAGE,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    return {
      ...session,
      preview: ELI_WELCOME_MESSAGE.slice(0, 60),
      messages: [welcomeMsg],
      screeningState: {
        ...(session.screeningState || INITIAL_SCREENING_STATE),
        step: "waiting_consent",
      },
    };
  }
  return session;
}

function buildPrefillFromUser(
  user?: { name?: string | null; email?: string | null; semestre?: string | null } | null,
): EliPrefillPatient | undefined {
  if (!user) return undefined;
  const iniciales = computeInitialsFromName(user.name, user.email);
  const fecha = getTodayMexicoDateString();
  return {
    iniciales: iniciales || undefined,
    fecha,
    semestre: user.semestre || undefined,
  };
}

function createFreshSession(prefill?: EliPrefillPatient): ChatSession {
  const id = `session-${Date.now()}`;
  const initialMsg: EliMessage = {
    id: crypto.randomUUID(),
    sender: "eli",
    text: ELI_WELCOME_MESSAGE,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  return {
    id,
    title: "Nuevo tamizaje",
    updatedAt: "Ahora",
    preview: ELI_WELCOME_MESSAGE.slice(0, 60),
    messages: [initialMsg],
    screeningState: {
      ...INITIAL_SCREENING_STATE,
      paciente: {
        ...INITIAL_SCREENING_STATE.paciente,
        iniciales: prefill?.iniciales || "",
        fecha: prefill?.fecha || getTodayMexicoDateString(),
        semestre: prefill?.semestre,
      },
      step: "waiting_consent",
    },
  };
}

function loadUserSessions(
  userIdOrEmail?: string | null,
  prefill?: EliPrefillPatient,
): ChatSession[] {
  clearLegacyUnscopedScreeningData();
  if (typeof window === "undefined" || !userIdOrEmail) return [createFreshSession(prefill)];

  try {
    const key = getChatSessionsStorageKey(userIdOrEmail);
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(ensureSessionHasWelcome);
      }
    }
  } catch {
    // fallback
  }
  return [createFreshSession(prefill)];
}

export function ChatPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();
  const prefillPatient = buildPrefillFromUser(user);

  const [isBlockedByBackend, setIsBlockedByBackend] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    return loadUserSessions(user?.id || user?.email, buildPrefillFromUser(user));
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const userIdOrEmail = user?.id || user?.email;
      if (userIdOrEmail) {
        const storedId = localStorage.getItem(getActiveSessionStorageKey(userIdOrEmail));
        if (storedId && sessions.some((s) => s.id === storedId)) {
          return storedId;
        }
      }
    } catch {
      // fallback
    }
    return sessions[0]?.id || "default-session";
  });

  useEffect(() => {
    const userIdOrEmail = user?.id || user?.email;
    const prefill = buildPrefillFromUser(user);
    const loaded = loadUserSessions(userIdOrEmail, prefill).map((s) => {
      if (
        prefill &&
        (s.screeningState?.step === "waiting_consent" || s.screeningState?.step === "not_started")
      ) {
        return {
          ...s,
          screeningState: {
            ...s.screeningState,
            paciente: {
              ...s.screeningState.paciente,
              iniciales: s.screeningState.paciente.iniciales || prefill.iniciales || "",
              fecha: s.screeningState.paciente.fecha || prefill.fecha || getTodayMexicoDateString(),
              semestre: s.screeningState.paciente.semestre || prefill.semestre,
            },
          },
        };
      }
      return s;
    });
    setSessions(loaded);
    let activeId = loaded[0]?.id || "default-session";
    if (userIdOrEmail) {
      try {
        const storedId = localStorage.getItem(getActiveSessionStorageKey(userIdOrEmail));
        if (storedId && loaded.some((s) => s.id === storedId)) {
          activeId = storedId;
        }
      } catch {
        // ignore
      }
    }
    setActiveSessionId(activeId);
  }, [user?.id, user?.email, user?.name, user?.semestre]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBreathingOpen, setIsBreathingOpen] = useState(false);
  const [isGroundingOpen, setIsGroundingOpen] = useState(false);
  const [eliHeaderImgFailed, setEliHeaderImgFailed] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [pendingSubmissionPayload, setPendingSubmissionPayload] =
    useState<TamizajeSubmissionPayload | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || createFreshSession();
  const messages = activeSession.messages;
  const screeningState = activeSession.screeningState || INITIAL_SCREENING_STATE;

  const isEffectiveBlocked = DEMO_MODE ? false : isBlockedByBackend;
  const isGatedByRisk = isEffectiveBlocked;

  // Panel lateral visible solo si el usuario es estudiante o psicólogo revisando (o vista previa sin sesión)
  const showSidePanel = !user || user.role === "estudiante" || user.role === "psicologo";

  // Detección inmediata en tiempo real mientras el usuario escribe en el input
  const hasInputCrisisKeyword = detectCrisisKeywords(inputText);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const messagesCount = messages.length;
  useEffect(() => {
    scrollToBottom();
  }, [messagesCount, isTyping, scrollToBottom]);

  const persistSessions = (newSessions: ChatSession[], newActiveId?: string) => {
    setSessions(newSessions);
    const userIdOrEmail = user?.id || user?.email;
    if (!userIdOrEmail) return;
    try {
      const sessionsKey = getChatSessionsStorageKey(userIdOrEmail);
      localStorage.setItem(sessionsKey, JSON.stringify(newSessions));
      if (newActiveId) {
        const activeKey = getActiveSessionStorageKey(userIdOrEmail);
        localStorage.setItem(activeKey, newActiveId);
      }
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function checkBlockedStatus() {
      if (DEMO_MODE) {
        if (isMounted) setIsBlockedByBackend(false);
        return;
      }

      let authUserId = user?.id;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          authUserId = authData.user.id;
        }
      } catch {
        // usar id de contexto si existe
      }

      const UUID_REGEX =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!authUserId || !UUID_REGEX.test(authUserId)) {
        if (isMounted) setIsBlockedByBackend(false);
        return;
      }

      try {
        let patientRow: {
          id?: string | number;
          bloqueado?: boolean | null;
          folio?: string | null;
        } | null = null;
        let queryCompleted = false;

        const q1 = await supabase
          .from("pacientes")
          .select("id, bloqueado, folio, fecha_registro")
          .eq("user_id", authUserId)
          .order("fecha_registro", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!q1.error) {
          patientRow = q1.data;
          queryCompleted = true;
        } else {
          const q2 = await supabase
            .from("pacientes")
            .select("id, bloqueado, folio, created_at")
            .eq("user_id", authUserId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!q2.error) {
            patientRow = q2.data;
            queryCompleted = true;
          } else {
            const q3 = await supabase
              .from("pacientes")
              .select("id, bloqueado, folio")
              .eq("user_id", authUserId)
              .order("id", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!q3.error) {
              patientRow = q3.data;
              queryCompleted = true;
            }
          }
        }

        if (queryCompleted && isMounted) {
          if (patientRow && patientRow.bloqueado === true) {
            setIsBlockedByBackend(true);
            if (patientRow.folio) {
              setStoredUserFolio(authUserId, patientRow.folio, user?.email);
            }
          } else if (!patientRow || patientRow.bloqueado === false) {
            setIsBlockedByBackend(false);

            setSessions((prevSessions) => {
              const hasCompleted = prevSessions.some((s) => s.screeningState?.step === "completed");
              if (hasCompleted || prevSessions.length === 0) {
                const fresh = createFreshSession(buildPrefillFromUser(user));
                const userIdOrEmail = authUserId || user?.email;
                if (userIdOrEmail) {
                  removeStoredUserFolio(authUserId, user?.email);
                  try {
                    localStorage.setItem(
                      getChatSessionsStorageKey(userIdOrEmail),
                      JSON.stringify([fresh]),
                    );
                    localStorage.setItem(getActiveSessionStorageKey(userIdOrEmail), fresh.id);
                  } catch {
                    // ignore
                  }
                }
                setActiveSessionId(fresh.id);
                return [fresh];
              }
              return prevSessions;
            });
          }
        }
      } catch (err) {
        console.warn("Aviso al consultar estado de bloqueo de paciente:", err);
        if (isMounted) setIsBlockedByBackend(false);
      }
    }

    checkBlockedStatus();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!activeSession || !activeSession.screeningState) return;
    const st = activeSession.screeningState;
    const msgs = activeSession.messages;
    if (!msgs || msgs.length === 0) return;

    const lastMsg = msgs[msgs.length - 1];
    const hasAnsweredQ9 =
      (st.step === "phq9" &&
        (st.phq9Items.length === 9 || (st.phq9Items.length === 8 && lastMsg?.sender === "user"))) ||
      (st.step === "completed" &&
        !msgs.some(
          (m) => m.sender === "eli" && (m.text.includes("folio") || m.text.includes("EQ-")),
        ));

    const alreadyHasEliFolio = msgs.some(
      (m) => m.sender === "eli" && (m.text.includes("folio") || m.text.includes("EQ-")),
    );

    if (hasAnsweredQ9 && !alreadyHasEliFolio) {
      let q9Score = 1;
      if (lastMsg && lastMsg.sender === "user") {
        const parsed = parseLikertOption(lastMsg.text);
        if (parsed !== null) q9Score = parsed;
      }
      const phq9Items = st.phq9Items.length === 9 ? st.phq9Items : [...st.phq9Items, q9Score];
      const gad7Total = st.gad7Items.reduce((a, b) => a + b, 0);
      const phq9Total = phq9Items.reduce((a, b) => a + b, 0);
      const item9Score = phq9Items[8] ?? q9Score;
      const isCrisis = item9Score > 0 || phq9Total >= 20 || gad7Total >= 15;
      const nivel: ScreeningNivel = isCrisis
        ? "rojo"
        : phq9Total >= 10 || gad7Total >= 10
          ? "amarillo"
          : "verde";
      const existingFolio =
        st.folio || getStoredUserFolio(user?.id, user?.email) || generateFolio();
      const userTranscript = msgs
        .filter((m) => m.sender === "user")
        .map((m) => m.text)
        .join(" ");
      const triaje =
        st.triaje ||
        evaluateTriajeFromScreening({
          gad7Items: st.gad7Items,
          phq9Items,
          extraText: userTranscript,
        });

      let replyText = "";
      if (nivel === "rojo") {
        replyText = `${CRISIS_MESSAGE}\n\n${triaje.mensaje}\n\nTu folio de tamizaje es: ${existingFolio}\nEscríbelo en el formulario para vincular tus resultados.\n\nGracias. Un profesional revisará tus respuestas.`;
      } else if (nivel === "amarillo") {
        replyText = `Gracias por completar tu tamizaje. ${triaje.mensaje}\n\nTu folio de tamizaje es: ${existingFolio}\nEscríbelo en el formulario para vincular tus resultados.\n\nGracias. Un profesional revisará tus respuestas.`;
      } else {
        replyText = `Tus resultados no muestran señales de alerta clínica grave en este momento. ${triaje.mensaje}\n\nTu folio de tamizaje es: ${existingFolio} por si deseas vincularlo.\n\nGracias. Un profesional revisará tus respuestas.`;
      }

      const eliMsg: EliMessage = {
        id: crypto.randomUUID(),
        sender: "eli",
        text: replyText,
        isCrisisProtocol: isCrisis,
        nivel,
        scores: {
          gad7Total,
          phq9Total,
          item9: item9Score,
        },
        crisisData: isCrisis
          ? {
              actionLabel: "Contactar a Línea de la Vida ahora",
              actionRoute: "/alerta",
              helplineName: "Línea de la Vida",
              helphoneNumber: "800 911 2000",
            }
          : undefined,
        triaje,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const userIdOrEmail = user?.id || user?.email;
      if (userIdOrEmail) {
        setStoredUserFolio(userIdOrEmail, existingFolio);
      }

      const updatedState: ScreeningState = {
        ...st,
        step: "completed",
        currentQuestionIndex: 8,
        phq9Items,
        folio: existingFolio,
        nivel,
        triaje,
      };

      const updatedSession: ChatSession = {
        ...activeSession,
        messages: [...msgs, eliMsg],
        screeningState: updatedState,
      };

      setSessions((prev) => {
        const nextSessions = prev.map((s) => (s.id === activeSession.id ? updatedSession : s));
        if (userIdOrEmail) {
          try {
            localStorage.setItem(
              getChatSessionsStorageKey(userIdOrEmail),
              JSON.stringify(nextSessions),
            );
          } catch {
            // ignore
          }
        }
        return nextSessions;
      });
    }
  }, [activeSessionId, activeSession, user?.id, user?.email]);

  const handleResetChat = async () => {
    try {
      let authUserId = user?.id;
      if (!authUserId) {
        const { data: authData } = await supabase.auth.getUser();
        authUserId = authData?.user?.id;
      }
      if (authUserId && !DEMO_MODE) {
        await supabase.from("pacientes").update({ bloqueado: false }).eq("user_id", authUserId);
      }
    } catch {
      // ignore
    }
    setIsBlockedByBackend(false);
    resetBackendScreeningState();
    setSubmissionError(null);
    setPendingSubmissionPayload(null);
    removeStoredUserFolio(user?.id, user?.email);
    clearLegacyUnscopedScreeningData();
    const freshSession = createFreshSession(prefillPatient);
    persistSessions([freshSession], freshSession.id);
    setActiveSessionId(freshSession.id);
    setInputText("");
    setIsTyping(false);
    toast.success("Chat reiniciado. Puedes comenzar un nuevo tamizaje.");
  };

  const handleRetrySubmission = async () => {
    if (!pendingSubmissionPayload || isTyping) return;
    setIsTyping(true);
    setSubmissionError(null);

    try {
      let currentUserId = pendingSubmissionPayload.user_id || user?.id || null;
      if (!currentUserId) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const UUID_REGEX =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (authData?.user?.id && UUID_REGEX.test(authData.user.id)) {
            currentUserId = authData.user.id;
          }
        } catch {
          currentUserId = null;
        }
      }

      const gad7Items = pendingSubmissionPayload.GAD7 || [];
      const phq9Items = pendingSubmissionPayload.PHQ9 || [];
      const gad7Total = gad7Items.reduce((a, b) => a + b, 0);
      const phq9Total = phq9Items.reduce((a, b) => a + b, 0);
      const item9Score = phq9Items[8] ?? 0;
      const isCrisis = item9Score > 0 || phq9Total >= 20 || gad7Total >= 15;
      const nivel: ScreeningNivel = isCrisis
        ? "rojo"
        : phq9Total >= 10 || gad7Total >= 10
          ? "amarillo"
          : "verde";
      const folioToUse =
        screeningState.folio || getStoredUserFolio(user?.id, user?.email) || generateFolio();

      const persistRes = await persistTamizajeToSupabase({
        folio: folioToUse,
        userId: currentUserId,
        carrera: user?.carrera,
        grupo: user?.grupo,
        semestre: user?.semestre,
        paciente: pendingSubmissionPayload.paciente,
        GAD7: gad7Items,
        PHQ9: phq9Items,
        nivel,
        alerta: isCrisis,
        mensajes: messages,
      });

      if (!persistRes.ok) {
        setSubmissionError(
          persistRes.error || "Error al guardar el tamizaje en Supabase. Por favor reintenta.",
        );
        return;
      }

      setPendingSubmissionPayload(null);
      setSubmissionError(null);

      const userIdOrEmail = user?.id || user?.email;
      if (userIdOrEmail && persistRes.folio) {
        setStoredUserFolio(userIdOrEmail, persistRes.folio);
      }

      const updatedState: ScreeningState = {
        ...screeningState,
        step: "completed",
        folio: persistRes.folio,
        nivel,
      };

      const updatedSessionFinal: ChatSession = {
        ...activeSession,
        updatedAt: "Ahora",
        screeningState: updatedState,
      };

      const finalSessions = sessions.map((s) =>
        s.id === activeSession.id ? updatedSessionFinal : s,
      );
      persistSessions(finalSessions);
      if (!DEMO_MODE && persistRes.bloqueado) {
        setIsBlockedByBackend(true);
      }
      toast.success(`Tamizaje ${persistRes.folio} guardado en base de datos`);

      if (nivel === "rojo" || isCrisis) {
        (async () => {
          try {
            await supabase.functions.invoke("notificar-psicologo-rojo", {
              body: {
                folio: persistRes.folio,
                paciente: pendingSubmissionPayload.paciente,
                gad7_total: gad7Total,
                gad7_items: gad7Items,
                phq9_total: phq9Total,
                phq9_items: phq9Items,
                item9_score: item9Score,
                estudiante_id: currentUserId || undefined,
                estudiante_email: user?.email || undefined,
                estudiante_nombre: user?.name || undefined,
                fecha: new Date().toISOString(),
              },
            });
          } catch {
            // edge function opcional
          }
          try {
            await notificarTutorNivelRojo({
              estudianteId: currentUserId || user?.id,
              folio: persistRes.folio,
              carrera: user?.carrera,
              grupo: user?.grupo,
            });
          } catch (retryAlertErr) {
            console.warn("[AlertaRojo] Aviso al reintentar alerta al tutor:", retryAlertErr);
          }
        })();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al conectar con Supabase para registrar el tamizaje.";
      setSubmissionError(msg);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewConversation = () => {
    setIsBlockedByBackend(false);
    resetBackendScreeningState();
    const freshSession = createFreshSession(prefillPatient);
    const updated = [freshSession, ...sessions];
    persistSessions(updated, freshSession.id);
    setActiveSessionId(freshSession.id);
    setIsHistoryOpen(false);
    setInputText("");
    toast.success("Nuevo tamizaje creado");
  };

  const handleSelectSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    const userIdOrEmail = user?.id || user?.email;
    if (userIdOrEmail) {
      try {
        localStorage.setItem(getActiveSessionStorageKey(userIdOrEmail), session.id);
      } catch {
        // ignore
      }
    }
    setIsHistoryOpen(false);
  };

  const handleClearAllHistory = () => {
    setIsBlockedByBackend(false);
    resetBackendScreeningState();
    const freshSession = createFreshSession(prefillPatient);
    persistSessions([freshSession], freshSession.id);
    setActiveSessionId(freshSession.id);
    setIsHistoryOpen(false);
    toast.info("Historial de tamizajes borrado.");
  };

  const getQuickReplies = (): string[] => {
    if (screeningState.step === "waiting_consent" || screeningState.step === "not_started") {
      return ["Sí", "No"];
    }
    if (screeningState.step === "waiting_sex") {
      return ["Femenino", "Masculino", "Otro"];
    }
    if (screeningState.step === "waiting_fecha") {
      const todayStr = new Date().toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return [todayStr, "Hoy"];
    }
    if (screeningState.step === "gad7" || screeningState.step === "phq9") {
      return ["Nunca", "Varios días", "Más de la mitad de los días", "Casi todos los días"];
    }
    return [];
  };

  const handleSendMessage = async (textToSend?: string) => {
    const raw = textToSend !== undefined ? textToSend : inputText;
    const trimmed = raw.trim();
    if (!trimmed || isTyping || isEffectiveBlocked) return;

    const sanitized = sanitizeText(trimmed, 300);
    const userTimestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: EliMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      text: sanitized,
      timestamp: userTimestamp,
    };

    const newMessages = [...messages, userMsg];

    const sessionWithUser = {
      ...activeSession,
      updatedAt: "Ahora",
      messages: newMessages,
      preview: sanitized.slice(0, 60),
    };

    const updatedSessionsInterim = sessions.map((s) =>
      s.id === activeSession.id ? sessionWithUser : s,
    );
    persistSessions(updatedSessionsInterim);

    setInputText("");
    setIsTyping(true);

    const hasCrisisKeyword = detectCrisisKeywords(sanitized);

    if (hasCrisisKeyword) {
      const eliTimestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const crisisFolio =
        screeningState.folio || getStoredUserFolio(user?.id, user?.email) || generateFolio();

      const eliMsg: EliMessage = {
        id: crypto.randomUUID(),
        sender: "eli",
        text: `${CRISIS_MESSAGE}\n\nTu seguridad es lo más importante en este momento. Hemos habilitado los canales de atención urgente 24/7.`,
        isCrisisProtocol: true,
        crisisData: {
          actionLabel: "Contactar a Línea de la Vida ahora",
          actionRoute: "/alerta",
          helplineName: "Línea de la Vida",
          helphoneNumber: "800 911 2000",
        },
        timestamp: eliTimestamp,
      };

      const finalMessages = [...newMessages, eliMsg];

      const updatedSessionCrisis: ChatSession = {
        ...activeSession,
        updatedAt: "Ahora",
        messages: finalMessages,
        preview: eliMsg.text.slice(0, 60),
        screeningState: {
          ...screeningState,
          nivel: "rojo",
          folio: crisisFolio,
        },
      };

      const finalSessions = sessions.map((s) =>
        s.id === activeSession.id ? updatedSessionCrisis : s,
      );
      persistSessions(finalSessions);
      setIsTyping(false);

      (async () => {
        try {
          let currentUserId: string | null = null;
          try {
            const { data: authData } = await supabase.auth.getUser();
            const UUID_REGEX =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (authData?.user?.id && UUID_REGEX.test(authData.user.id)) {
              currentUserId = authData.user.id;
            }
          } catch {
            currentUserId = null;
          }

          await supabase.functions.invoke("notificar-psicologo-rojo", {
            body: {
              folio: crisisFolio,
              paciente: {
                iniciales: screeningState.paciente.iniciales || "ALERTA-CHAT",
                edad: screeningState.paciente.edad || 0,
                sexo: screeningState.paciente.sexo || "No especificado",
                fecha: new Date().toLocaleDateString("es-MX"),
              },
              gad7_total: screeningState.gad7Items.reduce((a, b) => a + b, 0),
              phq9_total: screeningState.phq9Items.reduce((a, b) => a + b, 0),
              item9_score: 3,
              estudiante_id: currentUserId || undefined,
              estudiante_email: user?.email || undefined,
              estudiante_nombre: user?.name || undefined,
              fecha: new Date().toISOString(),
            },
          });

          await notificarTutorNivelRojo({
            estudianteId: currentUserId || user?.id,
            folio: crisisFolio,
            carrera: user?.carrera,
            grupo: user?.grupo,
          });
        } catch (alertaErr) {
          console.warn("[CrisisKeyword] Aviso al disparar notificación al psicólogo:", alertaErr);
        }
      })();

      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    const userContext = newMessages
      .filter((m) => m.sender === "user")
      .map((m) => m.text)
      .join(" ");
    const stepResult = processEliMessage(sanitized, screeningState, userContext, prefillPatient);

    if (stepResult.isReadyForSubmission && stepResult.submissionPayload) {
      const eliTimestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const isCrisis = Boolean(stepResult.isCrisis || stepResult.nivel === "rojo");
      const calculatedFolio = stepResult.folio || generateFolio();
      const calculatedNivel = stepResult.nivel || "verde";
      const calculatedTriaje = stepResult.triaje || stepResult.nextState.triaje;

      const eliMsg: EliMessage = {
        id: crypto.randomUUID(),
        sender: "eli",
        text:
          stepResult.replyText ||
          `Tamizaje completado. Tu folio de tamizaje es: ${calculatedFolio}.\nEscríbelo en el formulario para vincular tus resultados.\n\nGracias. Un profesional revisará tus respuestas.`,
        isCrisisProtocol: isCrisis,
        nivel: calculatedNivel,
        scores: stepResult.scores,
        crisisData: isCrisis
          ? {
              actionLabel: "Contactar a Línea de la Vida ahora",
              actionRoute: "/alerta",
              helplineName: "Línea de la Vida",
              helphoneNumber: "800 911 2000",
            }
          : undefined,
        triaje: calculatedTriaje,
        timestamp: eliTimestamp,
      };

      const finalMessages = [...newMessages, eliMsg];

      const userIdOrEmail = user?.id || user?.email;
      if (userIdOrEmail) {
        setStoredUserFolio(userIdOrEmail, calculatedFolio);
      }

      const updatedState: ScreeningState = {
        ...stepResult.nextState,
        step: "completed",
        folio: calculatedFolio,
        nivel: calculatedNivel,
        triaje: calculatedTriaje,
      };

      const updatedSessionFinal: ChatSession = {
        ...activeSession,
        updatedAt: "Ahora",
        messages: finalMessages,
        preview: eliMsg.text.slice(0, 60),
        screeningState: updatedState,
      };

      const nextSessionsList = sessions.map((s) =>
        s.id === activeSession.id ? updatedSessionFinal : s,
      );
      persistSessions(nextSessionsList);
      setIsTyping(false);
      toast.success("Tamizaje completado con éxito");

      let currentUserId: string | null = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        const UUID_REGEX =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (authData?.user?.id && UUID_REGEX.test(authData.user.id)) {
          currentUserId = authData.user.id;
        }
      } catch {
        currentUserId = null;
      }

      const payloadWithUser: TamizajeSubmissionPayload = {
        ...stepResult.submissionPayload,
        user_id: currentUserId,
      };

      (async () => {
        const persistRes = await persistTamizajeToSupabase({
          folio: calculatedFolio,
          userId: currentUserId,
          carrera: user?.carrera,
          grupo: user?.grupo,
          semestre: user?.semestre,
          paciente: stepResult.submissionPayload!.paciente,
          GAD7: stepResult.submissionPayload!.GAD7,
          PHQ9: stepResult.submissionPayload!.PHQ9,
          nivel: calculatedNivel,
          alerta: isCrisis,
          recomendaciones: stepResult.finalJson?.recomendaciones,
          mensajes: finalMessages,
        });

        if (persistRes.ok) {
          setSubmissionError(null);
          setPendingSubmissionPayload(null);

          if (persistRes.folio !== calculatedFolio) {
            if (userIdOrEmail) {
              setStoredUserFolio(userIdOrEmail, persistRes.folio);
            }
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeSession.id
                  ? {
                      ...s,
                      screeningState: {
                        ...s.screeningState,
                        folio: persistRes.folio,
                      },
                    }
                  : s,
              ),
            );
          }
        } else if (!DEMO_MODE && currentUserId) {
          setPendingSubmissionPayload(payloadWithUser);
          setSubmissionError(
            persistRes.error ||
              "No fue posible guardar tu tamizaje en Supabase. Haz clic en Reintentar envío.",
          );
        }
      })();

      if (calculatedNivel === "rojo" || isCrisis) {
        (async () => {
          const gad7Items = stepResult.submissionPayload?.GAD7 || [];
          const phq9Items = stepResult.submissionPayload?.PHQ9 || [];
          const gad7Total = gad7Items.reduce((a, b) => a + b, 0);
          const phq9Total = phq9Items.reduce((a, b) => a + b, 0);
          const item9Score = phq9Items[8] ?? 0;

          try {
            await supabase.functions.invoke("notificar-psicologo-rojo", {
              body: {
                folio: calculatedFolio,
                paciente: stepResult.submissionPayload?.paciente || {
                  iniciales: "",
                  edad: 0,
                  sexo: "",
                  fecha: getTodayMexicoDateString(),
                },
                gad7_total: gad7Total,
                gad7_items: gad7Items,
                phq9_total: phq9Total,
                phq9_items: phq9Items,
                item9_score: item9Score,
                estudiante_id: currentUserId || undefined,
                estudiante_email: user?.email || undefined,
                estudiante_nombre: user?.name || undefined,
                fecha: new Date().toISOString(),
              },
            });
          } catch {
            // Edge Function opcional si aún no se despliega
          }

          try {
            await notificarTutorNivelRojo({
              estudianteId: currentUserId || user?.id,
              folio: calculatedFolio,
              carrera: user?.carrera,
              grupo: user?.grupo,
            });
          } catch (alertaErr) {
            console.warn("[AlertaRojo] Aviso al notificar al tutor:", alertaErr);
          }
        })();
      }

      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    const eliTimestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const eliMsg: EliMessage = {
      id: crypto.randomUUID(),
      sender: "eli",
      text: stepResult.replyText,
      timestamp: eliTimestamp,
    };

    const finalMessages = [...newMessages, eliMsg];

    let sessionTitle = activeSession.title;
    if (stepResult.nextState.paciente.iniciales && sessionTitle === "Nuevo tamizaje") {
      sessionTitle = `Tamizaje — ${stepResult.nextState.paciente.iniciales}`;
    }

    const updatedSessionFinal: ChatSession = {
      ...activeSession,
      title: sessionTitle,
      updatedAt: "Ahora",
      messages: finalMessages,
      preview: eliMsg.text.slice(0, 60),
      screeningState: stepResult.nextState,
    };

    const finalSessions = sessions.map((s) =>
      s.id === activeSession.id ? updatedSessionFinal : s,
    );
    persistSessions(finalSessions);
    setIsTyping(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const quickReplies = getQuickReplies();
  const storedFolio = getStoredUserFolio(user?.id, user?.email);

  const renderEliAvatar = (sizePx: 32 | 80) => {
    const sizeClass = sizePx === 80 ? "size-20" : "size-8";
    if (eliHeaderImgFailed || !brandConfig.eliAvatarUrl) {
      return (
        <div
          className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-[#E5DFD3] bg-[#ECE8FA] text-xs font-bold text-[#7B6FD8]`}
        >
          Eli
        </div>
      );
    }

    return (
      <img
        src={brandConfig.eliAvatarUrl}
        alt="Eli, compañero de bienestar"
        width={sizePx}
        height={sizePx}
        decoding="async"
        onError={() => setEliHeaderImgFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full border border-[#E5DFD3] bg-white object-contain p-0.5`}
      />
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F1E8] font-sans text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <StudentTopBar title="Chat con Eli" backTo="/" showCrisisButton={true} />

      {/* Área principal dividida en 2 columnas en desktop (70% chat / 30% panel lateral), stack en móvil */}
      <div
        className={`grid flex-1 grid-cols-1 lg:min-h-0 lg:overflow-hidden ${
          showSidePanel ? "lg:grid-cols-[7fr_3fr]" : "lg:grid-cols-1"
        }`}
      >
        {/* COLUMNA CHAT (Izquierda, 70%) — Zona de Bienestar */}
        <section
          aria-label="Conversación de tamizaje con Eli"
          className="flex min-h-[70dvh] flex-col bg-[#ECE8FA] lg:h-[calc(100dvh-3.5rem)] lg:min-h-0 dark:bg-[#171B29]"
        >
          {/* Cabecera de conversación */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5DFD3] bg-white px-4 py-3.5 sm:px-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <div className="flex min-w-0 items-center gap-4">
              {renderEliAvatar(80)}
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Eli
                  </h2>
                  <Badge className="rounded-full border-0 bg-[#8FC9B5] px-2.5 py-0.5 text-xs font-semibold text-[#1A1A1A]">
                    En línea
                  </Badge>
                </div>
                <p className="truncate text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Tu compañero de bienestar · Tamizaje confidencial GAD-7 y PHQ-9
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {(DEMO_MODE || !isGatedByRisk) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetChat}
                  className="h-9 cursor-pointer gap-1.5 rounded-lg border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5] dark:hover:bg-[#1F4D2C]/30"
                  aria-label="Reiniciar tamizaje"
                >
                  <RotateCcw className="size-3.5" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Reiniciar</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsHistoryOpen(true)}
                className="h-9 cursor-pointer gap-1.5 rounded-lg border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5] dark:hover:bg-[#1F4D2C]/30"
                aria-label="Historial de tamizajes"
              >
                <History className="size-3.5" strokeWidth={1.75} />
                <span className="hidden sm:inline">Historial</span>
              </Button>
            </div>
          </div>

          {/* Banner inmediato rojo #C8102E si se detectan palabras clave de crisis en el input */}
          <AnimatePresence>
            {hasInputCrisisKeyword && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="flex shrink-0 flex-col gap-3 bg-[#C8102E] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex items-start gap-2.5 sm:items-center">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 sm:mt-0" strokeWidth={1.75} />
                  <p className="text-xs font-semibold leading-snug sm:text-sm">
                    Detectamos señales de posible riesgo o crisis emocional. Hay apoyo profesional
                    gratuito disponible las 24 horas.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => navigate({ to: "/alerta" })}
                  className="h-9 shrink-0 cursor-pointer rounded-lg bg-white px-4 text-xs font-bold text-[#C8102E] hover:bg-[#FEE2E2]"
                >
                  Ver ayuda urgente
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Banner de estado bloqueado (RD-07) */}
          {isEffectiveBlocked && (
            <div className="shrink-0 border-b border-[#B8860B]/30 bg-[#FBE6D5] px-4 py-3 text-[#1A1A1A] sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert
                    className="mt-0.5 size-4 shrink-0 text-[#B8860B]"
                    strokeWidth={1.75}
                  />
                  <p className="text-xs leading-relaxed font-medium">
                    Tu tamizaje está en revisión clínica. Un profesional del TESH evaluará tus
                    respuestas antes de habilitar una nueva aplicación.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleResetChat}
                  className="h-8 shrink-0 cursor-pointer rounded-lg bg-[#1F4D2C] px-3 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                >
                  Iniciar nuevo tamizaje
                </Button>
              </div>
            </div>
          )}

          {/* Lista de mensajes (scrollable) */}
          <main
            aria-label={`Mensajes de tamizaje con ${BRAND.assistant}`}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
          >
            <div className="mx-auto flex max-w-3xl flex-col space-y-4">
              {messages.map((msg) => {
                const isUser = msg.sender === "user";

                return (
                  <motion.div
                    key={msg.id}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`flex w-full items-start gap-2.5 ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isUser && renderEliAvatar(32)}

                      <div
                        className={`flex max-w-[75%] flex-col ${
                          isUser ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                            isUser
                              ? "rounded-br-sm bg-[#7B6FD8] font-medium text-white"
                              : "rounded-tl-sm border border-[#E5DFD3] bg-white text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>

                          {/* Tarjeta de Semáforo clínico + Folio dentro del mensaje de conclusión */}
                          {!isUser && (msg.text.includes("folio") || msg.text.includes("EQ-")) && (
                            <div className="mt-3 space-y-2.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-3 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
                              {(() => {
                                const nivelActual: ScreeningNivel =
                                  msg.nivel || screeningState.nivel || "verde";
                                const gadTotal =
                                  msg.scores?.gad7Total ??
                                  (screeningState.gad7Items || []).reduce((a, b) => a + b, 0);
                                const phqTotal =
                                  msg.scores?.phq9Total ??
                                  (screeningState.phq9Items || []).reduce((a, b) => a + b, 0);
                                const badgeBg =
                                  nivelActual === "rojo"
                                    ? "bg-[#C8102E] text-white"
                                    : nivelActual === "amarillo"
                                      ? "bg-[#B8860B] text-white"
                                      : "bg-[#1F4D2C] text-white";
                                const nivelTexto =
                                  nivelActual === "rojo"
                                    ? "Semáforo Rojo · Prioritario"
                                    : nivelActual === "amarillo"
                                      ? "Semáforo Amarillo · Seguimiento"
                                      : "Semáforo Verde · Sin alerta grave";

                                return (
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DFD3] pb-2.5 dark:border-[#2D3F2A]">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="flex items-center gap-1 rounded-full border border-[#E5DFD3] bg-white px-2 py-1 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                                        aria-label={`Semaforización: ${nivelTexto}`}
                                      >
                                        <span
                                          className={`size-2.5 rounded-full bg-[#1F4D2C] ${
                                            nivelActual === "verde"
                                              ? "ring-2 ring-[#1F4D2C]/40"
                                              : "opacity-25"
                                          }`}
                                          title="Verde"
                                        />
                                        <span
                                          className={`size-2.5 rounded-full bg-[#B8860B] ${
                                            nivelActual === "amarillo"
                                              ? "ring-2 ring-[#B8860B]/40"
                                              : "opacity-25"
                                          }`}
                                          title="Amarillo"
                                        />
                                        <span
                                          className={`size-2.5 rounded-full bg-[#C8102E] ${
                                            nivelActual === "rojo"
                                              ? "ring-2 ring-[#C8102E]/40"
                                              : "opacity-25"
                                          }`}
                                          title="Rojo"
                                        />
                                      </div>
                                      <span
                                        className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${badgeBg}`}
                                      >
                                        {nivelTexto}
                                      </span>
                                    </div>
                                    <span className="font-mono text-[11px] font-semibold text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                      GAD-7: {gadTotal}/21 · PHQ-9: {phqTotal}/27
                                    </span>
                                  </div>
                                );
                              })()}

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Ticket
                                    className="size-4 shrink-0 text-[#B8860B]"
                                    strokeWidth={1.75}
                                  />
                                  <span className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                    Folio oficial:
                                  </span>
                                  <span className="rounded-md bg-[#B8860B] px-2.5 py-0.5 font-mono text-xs font-bold text-white tabular-nums">
                                    {screeningState.folio ||
                                      msg.text.match(/EQ-\d{4}/)?.[0] ||
                                      storedFolio ||
                                      "EQ-PENDIENTE"}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const f =
                                      screeningState.folio ||
                                      msg.text.match(/EQ-\d{4}/)?.[0] ||
                                      storedFolio ||
                                      "";
                                    if (f) {
                                      navigator.clipboard.writeText(f);
                                      toast.success("Folio copiado al portapapeles");
                                    }
                                  }}
                                  className="h-7 cursor-pointer gap-1 rounded-md border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#1F4D2C] hover:bg-[#E0F0E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5] dark:hover:bg-[#1F4D2C]/30"
                                >
                                  <Copy className="size-3" strokeWidth={1.75} />
                                  <span>Copiar</span>
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Timestamp debajo de cada burbuja */}
                        <span className="mt-1 px-0.5 text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                          {msg.timestamp}
                        </span>

                        {/* Tarjeta de emergencia si se detectó protocolo de crisis */}
                        {msg.isCrisisProtocol && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 w-full rounded-lg border border-[#C8102E] bg-white p-4 text-[#1A1A1A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
                          >
                            <div className="flex items-start gap-2.5">
                              <ShieldAlert
                                className="mt-0.5 size-5 shrink-0 text-[#C8102E]"
                                strokeWidth={1.75}
                              />
                              <div className="flex-1 space-y-2">
                                <h3 className="text-sm font-bold text-[#C8102E]">
                                  Atención prioritaria disponible 24/7
                                </h3>
                                <p className="text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                                  Si atraviesas un momento difícil, comunícate de inmediato con las
                                  líneas gratuitas y confidenciales o accede al protocolo de ayuda.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => navigate({ to: "/alerta" })}
                                    className="h-9 cursor-pointer rounded-lg bg-[#C8102E] px-3 text-xs font-semibold text-white hover:bg-[#9B0C24]"
                                  >
                                    Ver ayuda urgente
                                  </Button>
                                  <a
                                    href="tel:8009112000"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 text-xs font-semibold text-[#1A1A1A] hover:bg-[#E0F0E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:bg-[#1F4D2C]/30"
                                  >
                                    <Phone
                                      className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]"
                                      strokeWidth={1.75}
                                    />
                                    <span>Línea de la Vida 800 911 2000</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                        {/* Tarjeta de recomendación de triaje profesional (Médico / Psicólogo / Mixto) */}
                        {!isUser && msg.triaje && (
                          <div className="mt-2 w-full rounded-lg border border-[#1F4D2C]/25 bg-white p-4 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
                            <div className="flex items-start gap-2.5">
                              {msg.triaje.tipo === "medico" ? (
                                <Stethoscope
                                  className="mt-0.5 size-5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
                                  strokeWidth={1.75}
                                />
                              ) : (
                                <Brain
                                  className="mt-0.5 size-5 shrink-0 text-[#7B6FD8]"
                                  strokeWidth={1.75}
                                />
                              )}
                              <div className="flex-1 space-y-2.5">
                                <div>
                                  <p className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                    {msg.triaje.tipo === "medico"
                                      ? "Orientación hacia Valoración Médica"
                                      : msg.triaje.tipo === "mixto"
                                        ? "Atención Integral Recomendada (Médica + Psicológica)"
                                        : "Orientación hacia Atención Psicológica"}
                                  </p>
                                  <p className="mt-1 text-xs leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
                                    {msg.triaje.mensaje}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {msg.triaje.acciones.map((accion) => (
                                    <Button
                                      key={accion.tipo}
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        navigate({
                                          to: "/citas",
                                          search: { tipo: accion.tipo },
                                        })
                                      }
                                      className={`h-9 cursor-pointer gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white ${
                                        accion.tipo === "medico"
                                          ? "bg-[#1F4D2C] hover:bg-[#4A7C59]"
                                          : "bg-[#7B6FD8] hover:bg-[#6A5FC9]"
                                      }`}
                                    >
                                      {accion.tipo === "medico" ? (
                                        <Stethoscope className="size-3.5" strokeWidth={1.75} />
                                      ) : (
                                        <Brain className="size-3.5" strokeWidth={1.75} />
                                      )}
                                      <span>{accion.label}</span>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Error de envío a Supabase con botón Reintentar */}
              {submissionError && (
                <div className="mx-auto w-full max-w-md space-y-2.5 rounded-lg border border-[#C8102E] bg-white p-4 text-center dark:bg-[#1A2618]">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-[#FEE2E2] text-[#C8102E]">
                    <AlertTriangle className="size-5" strokeWidth={1.75} />
                  </div>
                  <h4 className="text-sm font-bold text-[#C8102E]">
                    Error al registrar el tamizaje
                  </h4>
                  <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">{submissionError}</p>
                  <Button
                    type="button"
                    onClick={handleRetrySubmission}
                    disabled={isTyping}
                    className="h-9 cursor-pointer gap-1.5 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#9B0C24]"
                  >
                    <RotateCcw className="size-3.5" strokeWidth={1.75} />
                    <span>Reintentar envío</span>
                  </Button>
                </div>
              )}

              {/* Tarjeta de conclusión al terminar el tamizaje */}
              {screeningState.step === "completed" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-auto w-full max-w-lg rounded-lg border border-[#E5DFD3] bg-white p-5 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                >
                  {(() => {
                    const nivelFinal: ScreeningNivel = screeningState.nivel || "verde";
                    const gadTotal = (screeningState.gad7Items || []).reduce((a, b) => a + b, 0);
                    const phqTotal = (screeningState.phq9Items || []).reduce((a, b) => a + b, 0);
                    const iconContainerClass =
                      nivelFinal === "rojo"
                        ? "bg-[#FEE2E2] text-[#C8102E]"
                        : nivelFinal === "amarillo"
                          ? "bg-[#FEF3C7] text-[#B8860B]"
                          : "bg-[#E0F0E8] text-[#1F4D2C]";
                    const nivelBadgeClass =
                      nivelFinal === "rojo"
                        ? "bg-[#C8102E] text-white"
                        : nivelFinal === "amarillo"
                          ? "bg-[#B8860B] text-white"
                          : "bg-[#1F4D2C] text-white";
                    const nivelTitulo =
                      nivelFinal === "rojo"
                        ? "Semáforo Rojo · Atención prioritaria"
                        : nivelFinal === "amarillo"
                          ? "Semáforo Amarillo · Seguimiento recomendado"
                          : "Semáforo Verde · Sin alerta clínica grave";

                    return (
                      <>
                        <div
                          className={`mx-auto mb-2.5 flex size-11 items-center justify-center rounded-lg ${iconContainerClass}`}
                        >
                          <CheckCircle2 className="size-6" strokeWidth={1.75} />
                        </div>
                        <h3 className="text-base font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          Tamizaje finalizado
                        </h3>

                        {/* Semaforización visual Verde / Amarillo / Rojo */}
                        <div className="mx-auto mt-3 flex max-w-sm flex-col items-center gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3.5 py-2.5 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <div className="flex items-center gap-1.5 rounded-full border border-[#E5DFD3] bg-white px-2.5 py-1 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                              <span
                                className={`size-3 rounded-full bg-[#1F4D2C] ${
                                  nivelFinal === "verde" ? "ring-2 ring-[#1F4D2C]/40" : "opacity-25"
                                }`}
                                title="Verde"
                              />
                              <span
                                className={`size-3 rounded-full bg-[#B8860B] ${
                                  nivelFinal === "amarillo"
                                    ? "ring-2 ring-[#B8860B]/40"
                                    : "opacity-25"
                                }`}
                                title="Amarillo"
                              />
                              <span
                                className={`size-3 rounded-full bg-[#C8102E] ${
                                  nivelFinal === "rojo" ? "ring-2 ring-[#C8102E]/40" : "opacity-25"
                                }`}
                                title="Rojo"
                              />
                            </div>
                            <span
                              className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${nivelBadgeClass}`}
                            >
                              {nivelTitulo}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-[11px] font-semibold text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                            <span>
                              Folio: {screeningState.folio || storedFolio || "EQ-PENDIENTE"}
                            </span>
                            <span>·</span>
                            <span>GAD-7: {gadTotal}/21</span>
                            <span>·</span>
                            <span>PHQ-9: {phqTotal}/27</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <p className="mt-3 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                    {screeningState.triaje?.mensaje ||
                      (screeningState.nivel === "rojo"
                        ? "Requieres atención prioritaria. Agenda tu cita hoy mismo en Agenda de Citas."
                        : screeningState.nivel === "amarillo"
                          ? "Se sugiere recibir atención profesional. Puedes agendar tu cita con tu folio asignado."
                          : "Tus respuestas no muestran señales de alerta en este momento.")}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                    {screeningState.triaje ? (
                      screeningState.triaje.acciones.map((accion) => (
                        <Button
                          key={accion.tipo}
                          type="button"
                          size="sm"
                          onClick={() =>
                            navigate({
                              to: "/citas",
                              search: { tipo: accion.tipo },
                            })
                          }
                          className={`h-9 cursor-pointer gap-1.5 rounded-lg px-4 text-xs font-semibold text-white ${
                            accion.tipo === "medico"
                              ? "bg-[#1F4D2C] hover:bg-[#4A7C59]"
                              : "bg-[#7B6FD8] hover:bg-[#6A5FC9]"
                          }`}
                        >
                          {accion.tipo === "medico" ? (
                            <Stethoscope className="size-3.5" strokeWidth={1.75} />
                          ) : (
                            <Brain className="size-3.5" strokeWidth={1.75} />
                          )}
                          <span>{accion.label}</span>
                        </Button>
                      ))
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => navigate({ to: "/citas" })}
                        className="h-9 cursor-pointer rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                      >
                        Ir a Agenda de Citas
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetChat}
                      className="h-9 cursor-pointer gap-1.5 rounded-lg border-[#E5DFD3] bg-white px-4 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:bg-[#1F4D2C]/30"
                    >
                      <RotateCcw className="size-3.5" strokeWidth={1.75} />
                      <span>Nuevo tamizaje</span>
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Indicador "Eli está escribiendo..." con 3 puntos animados (Framer Motion) */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5"
                  >
                    {renderEliAvatar(32)}
                    <div className="flex items-center gap-2 rounded-lg rounded-tl-sm border border-[#E5DFD3] bg-white px-4 py-3 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      <div className="flex items-center gap-1" aria-hidden="true">
                        {[0, 1, 2].map((dotIdx) => (
                          <motion.span
                            key={dotIdx}
                            className="size-2 rounded-full bg-[#7B6FD8]"
                            animate={
                              shouldReduceMotion
                                ? { opacity: 0.8 }
                                : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }
                            }
                            transition={{
                              duration: 0.8,
                              repeat: Infinity,
                              delay: dotIdx * 0.16,
                              ease: "easeInOut",
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Eli está escribiendo...
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          </main>

          {/* Input fijo abajo */}
          <footer className="shrink-0 border-t border-[#E5DFD3] bg-white px-4 py-3 sm:px-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <div className="mx-auto max-w-3xl space-y-2.5">
              {/* Opciones rápidas según el paso clínico */}
              {quickReplies.length > 0 &&
                !isTyping &&
                !isEffectiveBlocked &&
                screeningState.step !== "completed" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Respuestas rápidas:
                    </span>
                    {quickReplies.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => handleSendMessage(reply)}
                        className="cursor-pointer rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition-colors hover:border-[#7B6FD8] hover:bg-[#ECE8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B6FD8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}

              {/* Grabadora de nota de voz */}
              {showVoiceRecorder && (
                <div className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  <VoiceNoteRecorder
                    folio={screeningState.folio}
                    disabled={isEffectiveBlocked || isTyping}
                    onTranscriptionReady={(texto) => {
                      setShowVoiceRecorder(false);
                      handleSendMessage(texto);
                    }}
                  />
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2.5"
              >
                {/* Botón secundario "Nota de voz" circular menta a la izquierda del input */}
                <Button
                  type="button"
                  disabled={isEffectiveBlocked || isTyping}
                  onClick={() => setShowVoiceRecorder((prev) => !prev)}
                  aria-label="Nota de voz"
                  title="Nota de voz"
                  className="size-12 shrink-0 cursor-pointer rounded-full bg-[#8FC9B5] p-0 text-white transition-colors hover:bg-[#7AB5A1] focus-visible:ring-2 focus-visible:ring-[#8FC9B5] disabled:opacity-50"
                >
                  <Mic className="size-5" strokeWidth={1.75} />
                </Button>

                {/* Input shadcn h-12 */}
                <Input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isEffectiveBlocked}
                  placeholder={
                    isEffectiveBlocked
                      ? "Tamizaje finalizado y en revisión clínica."
                      : "Escribe tu respuesta para Eli..."
                  }
                  className="h-12 flex-1 rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:border-[#7B6FD8] focus-visible:ring-2 focus-visible:ring-[#7B6FD8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                />

                {/* Botón enviar calm lavanda h-12 */}
                <Button
                  type="submit"
                  disabled={!inputText.trim() || isTyping || isEffectiveBlocked}
                  aria-label="Enviar mensaje"
                  className="h-12 shrink-0 cursor-pointer gap-2 rounded-lg bg-[#7B6FD8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6A5FC9] focus-visible:ring-2 focus-visible:ring-[#7B6FD8] disabled:opacity-40"
                >
                  <Send className="size-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Enviar</span>
                </Button>
              </form>
            </div>
          </footer>
        </section>

        {/* PANEL LATERAL (Derecha, 30%) — Solo visible para estudiante o psicólogo */}
        {showSidePanel && (
          <aside
            aria-label="Panel de progreso y bienestar"
            className="border-t border-[#E5DFD3] bg-[#F5F1E8] p-4 sm:p-5 lg:h-[calc(100dvh-6.5rem)] lg:overflow-y-auto lg:border-t-0 lg:border-l dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
          >
            <ChatSidePanel
              screeningState={screeningState}
              storedFolio={storedFolio}
              userKey={user?.id || user?.email}
              onOpenBreathing={() => setIsBreathingOpen(true)}
              onOpenGrounding={() => setIsGroundingOpen(true)}
            />
          </aside>
        )}
      </div>

      {/* Modales de ejercicios rápidos */}
      <BreathingModal isOpen={isBreathingOpen} onClose={() => setIsBreathingOpen(false)} />
      <GroundingModal isOpen={isGroundingOpen} onClose={() => setIsGroundingOpen(false)} />

      {/* Sheet lateral de historial de tamizajes */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-l border-[#E5DFD3] bg-white p-6 sm:max-w-md dark:border-[#2D3F2A] dark:bg-[#1A2618]"
        >
          <SheetHeader className="border-b border-[#E5DFD3] pb-4 text-left dark:border-[#2D3F2A]">
            <SheetTitle className="text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
              Historial de tamizajes
            </SheetTitle>
            <SheetDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Consulta sesiones previas o inicia una nueva evaluación con Eli.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {DEMO_MODE || !isEffectiveBlocked ? (
              <Button
                type="button"
                onClick={handleNewConversation}
                className="h-10 w-full cursor-pointer gap-2 rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
              >
                <Plus className="size-4" strokeWidth={1.75} />
                <span>Nuevo tamizaje con Eli</span>
              </Button>
            ) : (
              <div className="rounded-lg border border-[#B8860B]/30 bg-[#F5F1E8] p-3 text-xs text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
                <p className="font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Tamizaje en resguardo clínico
                </p>
                <p className="mt-1 text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Un profesional del TESH debe habilitar una nueva evaluación tras revisar tus
                  resultados.
                </p>
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Sesiones guardadas ({sessions.length})
                </span>
                {sessions.length > 1 && (DEMO_MODE || !isGatedByRisk) && (
                  <button
                    type="button"
                    onClick={handleClearAllHistory}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#C8102E] hover:underline"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    <span>Borrar todo</span>
                  </button>
                )}
              </div>

              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {sessions.map((session) => {
                  const isActive = session.id === activeSession.id;
                  const isDone = session.screeningState?.step === "completed";

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => handleSelectSession(session)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                        isActive
                          ? "border-[#1F4D2C] bg-[#E0F0E8]/60 dark:border-[#8FC9B5] dark:bg-[#0F1A12]"
                          : "border-[#E5DFD3] bg-white hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-xs font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {session.title}
                          </h3>
                          <span className="shrink-0 text-[11px] text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                            {session.updatedAt}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {session.preview || "Sin mensajes aún"}
                        </p>
                        <div className="flex items-center gap-2 pt-0.5 text-[11px] font-medium">
                          {isActive && (
                            <span className="text-[#1F4D2C] dark:text-[#8FC9B5]">Activa</span>
                          )}
                          {isDone ? (
                            <span className="text-[#1F4D2C] dark:text-[#8FC9B5]">Completado</span>
                          ) : (
                            <span className="text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                              {session.messages.length} mensajes
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-[#6B6B6B] dark:text-[#A6B5A3]"
                        strokeWidth={1.75}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

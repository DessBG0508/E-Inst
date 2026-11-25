import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Calendar,
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  Info,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getNotificationsForRole,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type AppNotification,
} from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  getUnreadStudentAlerts,
  markStudentAlertaAsRead,
  type AlertaInasistencia,
} from "@/features/tutor/tutor-service";
import type { UserRole } from "@/lib/types";

interface NotificationsCenterProps {
  role: UserRole;
  onSelectCase?: (caseId: string) => void;
  onOpenAgenda?: () => void;
  redAlertsCount?: number;
  triggerClassName?: string;
}

interface RedAlertItem {
  folio: string;
  iniciales: string;
  carrera?: string;
  semestre?: string | number;
  ultimo_nivel?: string;
  phq9_total?: number;
  gad7_total?: number;
  bloqueado?: boolean;
  tiene_alerta_activa?: boolean;
  ultimo_tamizaje?: string;
}

export function NotificationsCenter({
  role,
  onSelectCase,
  onOpenAgenda,
  redAlertsCount: propRedAlertsCount,
  triggerClassName,
}: NotificationsCenterProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [studentAlerts, setStudentAlerts] = useState<AlertaInasistencia[]>([]);
  const [filter, setFilter] = useState<"all" | "alerts" | "citas">("all");
  const [redAlertsViewCount, setRedAlertsViewCount] = useState<number | null>(null);
  const [, setRealtimeRedCases] = useState<RedAlertItem[]>([]);
  const toastedAlertIdsRef = useRef<Set<string>>(new Set());

  const formatStudentAlertText = useCallback((alerta: AlertaInasistencia) => {
    if (alerta.tipo_alerta === "no_asistio" || alerta.tipo_alerta === "inasistencia_repetida") {
      const dateMatch = alerta.mensaje.match(/\d{4}-\d{2}-\d{2}/);
      const fecha =
        dateMatch?.[0] ||
        new Date(alerta.created_at).toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      return {
        title: `No asististe a tu cita del ${fecha}. Por favor reagenda`,
        body: alerta.mensaje,
        type: "alerta_roja" as const,
      };
    }

    return {
      title: "Recordatorio: Tienes una cita pendiente con el psicólogo",
      body: alerta.mensaje,
      type: "cita_recordatorio" as const,
    };
  }, []);

  const loadNotifications = useCallback(() => {
    setNotifications(getNotificationsForRole(role));
  }, [role]);

  const loadStudentAlerts = useCallback(async () => {
    if (role !== "estudiante" || !user?.id) return;
    try {
      const list = await getUnreadStudentAlerts(user.id);
      setStudentAlerts(list);

      for (const alerta of list) {
        if (!toastedAlertIdsRef.current.has(alerta.id)) {
          toastedAlertIdsRef.current.add(alerta.id);
          const formatted = formatStudentAlertText(alerta);
          toast.info(formatted.title, { description: formatted.body });
        }
      }
    } catch {
      // Ignorar fallos transitorios
    }
  }, [role, user?.id, formatStudentAlertText]);

  // Consulta en tiempo real a la vista oficial para_psicologo
  const fetchRedAlertsFromView = useCallback(async () => {
    if (role !== "psicologo") return;
    try {
      const { data, error } = await supabase
        .from("para_psicologo")
        .select(
          "folio, iniciales, carrera, semestre, ultimo_nivel, phq9_total, gad7_total, bloqueado, tiene_alerta_activa, ultimo_tamizaje",
        )
        .eq("ultimo_nivel", "rojo");

      if (!error && Array.isArray(data)) {
        // Alertas de nivel 'rojo' pendientes de atención (bloqueado !== false o alerta activa)
        const pending = data.filter((p) => p.bloqueado !== false || p.tiene_alerta_activa === true);
        const count = pending.length > 0 ? pending.length : data.length;
        setRedAlertsViewCount(count);
        setRealtimeRedCases(data as RedAlertItem[]);
      }
    } catch (err) {
      console.warn("Aviso al consultar vista para_psicologo en notificaciones:", err);
    }
  }, [role]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (role !== "estudiante") return;
    loadStudentAlerts();
    const interval = setInterval(loadStudentAlerts, 10000);
    return () => clearInterval(interval);
  }, [role, loadStudentAlerts]);

  useEffect(() => {
    if (role !== "psicologo") return;
    fetchRedAlertsFromView();

    const interval = setInterval(fetchRedAlertsFromView, 10000);

    const channel = supabase
      .channel("psicologo-notifs-para-psicologo")
      .on("postgres_changes", { event: "*", schema: "public", table: "pacientes" }, () => {
        fetchRedAlertsFromView();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "respuestas_tamizaje" },
        () => {
          fetchRedAlertsFromView();
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [role, fetchRedAlertsFromView]);

  const studentAlertNotifications: AppNotification[] =
    role === "estudiante"
      ? studentAlerts.map((alerta) => {
          const formatted = formatStudentAlertText(alerta);
          return {
            id: `student-alerta::${alerta.id}`,
            recipientRole: "estudiante",
            type: formatted.type,
            title: formatted.title,
            message: formatted.body,
            timestamp: new Date(alerta.created_at).toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
            }),
            read: Boolean(alerta.leida_estudiante),
            priority: "alta",
            actionLabel: "Agendar cita",
          };
        })
      : [];

  const combinedNotifications = [...studentAlertNotifications, ...notifications];
  const unreadCount = combinedNotifications.filter((n) => !n.read).length;

  const filteredNotifications = combinedNotifications.filter((n) => {
    if (filter === "alerts") {
      return n.type === "alerta_roja" || n.type === "alerta_amarilla";
    }
    if (filter === "citas") {
      return n.type === "cita_nueva" || n.type === "cita_recordatorio";
    }
    return true;
  });

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (id.startsWith("student-alerta::")) {
      const realId = id.replace("student-alerta::", "");
      await markStudentAlertaAsRead(realId);
      setStudentAlerts((prev) => prev.filter((a) => a.id !== realId));
      return;
    }
    markNotificationAsRead(id);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    for (const alerta of studentAlerts) {
      await markStudentAlertaAsRead(alerta.id);
    }
    setStudentAlerts([]);
    markAllNotificationsAsRead(role);
    loadNotifications();
    toast.success("Todas las notificaciones marcadas como leídas");
  };

  const handleAction = async (notif: AppNotification) => {
    await handleMarkAsRead(notif.id);
    if (notif.id.startsWith("student-alerta::")) {
      setIsOpen(false);
      navigate({ to: "/citas" });
      return;
    }
    if (notif.caseId && onSelectCase) {
      setIsOpen(false);
      onSelectCase(notif.caseId);
      return;
    }
    if ((notif.type === "cita_nueva" || notif.type === "cita_recordatorio") && onOpenAgenda) {
      setIsOpen(false);
      onOpenAgenda();
      return;
    }
    toast.info(notif.title, { description: notif.message });
  };

  const renderIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "alerta_roja":
        return <ShieldAlert className="size-5 text-rose-600" />;
      case "alerta_amarilla":
        return <AlertTriangle className="size-5 text-amber-600" />;
      case "cita_nueva":
      case "cita_recordatorio":
        return <Calendar className="size-5 text-teal" />;
      case "checkin_nuevo":
        return <Sparkles className="size-5 text-indigo-500" />;
      default:
        return <Info className="size-5 text-muted-foreground" />;
    }
  };

  // Para psicólogo: contador oficial de alertas nivel "rojo" pendientes de atención
  const pendingRedCount =
    redAlertsViewCount !== null
      ? redAlertsViewCount
      : propRedAlertsCount !== undefined
        ? propRedAlertsCount
        : notifications.filter((n) => n.type === "alerta_roja" && !n.read).length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Centro de notificaciones y alertas"
          className={
            triggerClassName ||
            "relative rounded-full bg-card/80 transition-colors hover:bg-card shadow-sm"
          }
        >
          <Bell className="size-5 text-current" strokeWidth={1.75} />
          {role === "psicologo"
            ? pendingRedCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C8102E] px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#1A2618]"
                  title={`${pendingRedCount} alertas de nivel rojo pendientes de atención`}
                >
                  {pendingRedCount > 9 ? "9+" : pendingRedCount}
                </span>
              )
            : unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#B8860B] text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#1A2618]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex h-full w-full flex-col border-[#E5DFD3] bg-white p-0 text-[#1A1A1A] sm:max-w-md dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
      >
        <SheetHeader className="border-b border-[#E5DFD3] bg-[#F5F1E8] p-5 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-lg bg-[#1F4D2C] text-white">
                <Bell className="size-4" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  {role === "psicologo" ? "Alertas y Notificaciones" : "Notificaciones"}
                </SheetTitle>
                <SheetDescription className="text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
                  {role === "psicologo"
                    ? pendingRedCount > 0
                      ? `${pendingRedCount} alerta(s) nivel rojo pendientes`
                      : "Sin alertas críticas pendientes"
                    : unreadCount > 0
                      ? `${unreadCount} pendientes de atención`
                      : "Estás al día con tus avisos"}
                </SheetDescription>
              </div>
            </div>

            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-8 gap-1.5 px-2.5 text-xs text-[#1F4D2C] hover:bg-white dark:text-[#8FC9B5] dark:hover:bg-[#1A2618]"
              >
                <CheckCheck className="size-3.5" />
                <span>Marcar leídas</span>
              </Button>
            )}
          </div>

          {role === "psicologo" && pendingRedCount > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-[#C8102E]/30 bg-white px-3 py-2 text-xs dark:bg-[#1A2618]">
              <span className="font-bold text-[#C8102E]">
                {pendingRedCount}{" "}
                {pendingRedCount === 1 ? "caso en nivel rojo" : "casos en nivel rojo"} por atender
              </span>
              <Badge variant="danger" className="px-2 py-0.5 text-[10px]">
                Alta Prioridad
              </Badge>
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-3">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className="h-8 rounded-lg px-2.5 text-xs"
            >
              Todas ({combinedNotifications.length})
            </Button>
            <Button
              size="sm"
              variant={filter === "alerts" ? "danger" : "outline"}
              onClick={() => setFilter("alerts")}
              className="h-8 rounded-lg px-2.5 text-xs"
            >
              Alertas ({combinedNotifications.filter((n) => n.type.startsWith("alerta")).length})
            </Button>
            <Button
              size="sm"
              variant={filter === "citas" ? "accent" : "outline"}
              onClick={() => setFilter("citas")}
              className="h-8 rounded-lg px-2.5 text-xs"
            >
              Citas ({combinedNotifications.filter((n) => n.type.startsWith("cita")).length})
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[#6B6B6B] dark:text-[#A8B5A0]">
              <div className="mb-3 grid size-14 place-items-center rounded-lg bg-[#F5F1E8] dark:bg-[#0F1A12]">
                <Inbox className="size-7" />
              </div>
              <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                No hay notificaciones
              </p>
              <p className="mt-1 max-w-xs text-xs">
                No tienes avisos pendientes en este filtro en este momento.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isAlert = notif.type === "alerta_roja";
              return (
                <div
                  key={notif.id}
                  onClick={() => handleAction(notif)}
                  className={`group relative cursor-pointer rounded-lg border p-3.5 transition-colors ${
                    notif.read
                      ? "border-[#E5DFD3] bg-[#F5F1E8]/40 dark:border-[#2D3F2A] dark:bg-[#0F1A12]/40"
                      : isAlert
                        ? "border-[#C8102E]/35 bg-white hover:border-[#C8102E] dark:bg-[#0F1A12]"
                        : "border-[#B8860B]/40 bg-white hover:border-[#1F4D2C] dark:bg-[#0F1A12]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                        isAlert
                          ? "bg-[#C8102E]/10 text-[#C8102E]"
                          : notif.type.startsWith("cita")
                            ? "bg-[#B8860B]/15 text-[#B8860B]"
                            : "bg-[#1F4D2C]/10 text-[#1F4D2C] dark:text-[#8FC9B5]"
                      }`}
                    >
                      {renderIcon(notif.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-xs font-bold leading-snug ${
                            !notif.read
                              ? "text-[#1A1A1A] dark:text-[#F5F1E8]"
                              : "text-[#6B6B6B] dark:text-[#A8B5A0]"
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="shrink-0 font-mono text-[10px] text-[#6B6B6B] tabular-nums dark:text-[#A8B5A0]">
                          {notif.timestamp}
                        </span>
                      </div>

                      <p className="mt-1 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A8B5A0]">
                        {notif.message}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                        {notif.actionLabel ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F4D2C] group-hover:underline dark:text-[#8FC9B5]">
                            {notif.actionLabel}
                            <ChevronRight className="size-3" />
                          </span>
                        ) : (
                          <span />
                        )}

                        {!notif.read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold text-[#6B6B6B] transition-colors hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A8B5A0] dark:hover:bg-[#1A2618] dark:hover:text-[#8FC9B5]"
                          >
                            <CheckCheck className="size-3" />
                            Marcar leída
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

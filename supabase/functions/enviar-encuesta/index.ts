import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_URL = "https://api.resend.com/emails";
const INSTITUTIONAL_FROM = "Equilibra TESH Encuestas <citas@equilibra-tesh.edu.mx>";
const RESEND_ONBOARDING_FROM = "Equilibra TESH Encuestas <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface EnviarEncuestaPayload {
  action?: "enviar" | "validar_folio";
  folio: string;
  user_id?: string;
  trigger_tipo?: "alta" | "abandono";
  destinatarioEmail?: string;
  destinatarioNombre?: string;
  enlaceEncuesta?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Plantilla HTML institucional para la Encuesta de Satisfacción PB-021
 * Paleta institucional TESH: Verde Bosque (#1F4D2C), Crema (#F5F1E8), Dorado (#B8860B)
 */
function generarEmailEncuestaHtml(params: EnviarEncuestaPayload): string {
  const triggerTipo = params.trigger_tipo || "alta";
  const esAlta = triggerTipo === "alta";
  const safeFolio = escapeHtml(params.folio);
  const nombre = escapeHtml(params.destinatarioNombre || `Estudiante (${params.folio})`);
  const urlBase = "https://equilibra-tesh.edu.mx";
  const rawEnlace =
    params.enlaceEncuesta ||
    `${urlBase}/encuesta?folio=${encodeURIComponent(params.folio)}&tipo=${triggerTipo}`;
  const enlace = escapeHtml(rawEnlace);

  const tituloBanner = esAlta
    ? "Felicidades por concluir tu proceso de atención"
    : "Tu bienestar sigue siendo nuestra prioridad";

  const mensajePrincipal = esAlta
    ? "Has completado exitosamente tus sesiones de acompañamiento psicológico en el Tecnológico de Estudios Superiores de Huixquilucan. Tu experiencia nos ayuda a seguir elevando la calidad del servicio."
    : "Hemos notado que no pudiste acudir a tus últimas citas programadas. Queremos conocer si existieron barreras de horario, traslado o académicas, y ofrecerte alternativas para retomar tu bienestar cuando estés listo/a.";

  const badgeTrigger = esAlta ? "Alta de Proceso Clínico" : "Seguimiento por Inasistencia";

  const plazoTexto = esAlta
    ? "El enlace estará disponible para responderse en las próximas 24 horas."
    : "Cuentas con una ventana de 15 días naturales para contestar este formulario.";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Equilibra TESH - Encuesta de Satisfacción PB-021</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f1e8; margin: 0; padding: 24px; color: #1a1a1a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5dfd3;">
    <tr>
      <td style="background: #1f4d2c; padding: 32px 28px; text-align: center;">
        <span style="display: inline-block; background: rgba(255,255,255,0.16); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 6px; margin-bottom: 12px;">
          PB-021 · Calidad y Satisfacción
        </span>
        <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; line-height: 1.3;">
          ${tituloBanner}
        </h1>
        <p style="color: #f5f1e8; font-size: 13px; margin: 8px 0 0 0;">
          Tecnológico de Estudios Superiores de Huixquilucan (TESH)
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 28px;">
        <p style="font-size: 15px; font-weight: 600; margin: 0 0 12px 0;">
          Hola, ${nombre}
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
          ${mensajePrincipal}
        </p>
        
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #f5f1e8; border: 1px solid #e5dfd3; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
          <tr>
            <td style="font-size: 12px; color: #6b6b6b; line-height: 1.5;">
              <strong style="color: #1f4d2c;">Folio del caso:</strong> ${safeFolio}<br/>
              <strong style="color: #1f4d2c;">Motivo de envío:</strong> ${badgeTrigger}<br/>
              <strong style="color: #1f4d2c;">Plazo de respuesta:</strong> ${plazoTexto}
            </td>
          </tr>
        </table>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${enlace}" style="display: inline-block; background: #1f4d2c; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 28px; border-radius: 8px;">
            Completar Encuesta PB-021 &rarr;
          </a>
        </div>

        <p style="font-size: 12px; line-height: 1.5; color: #6b6b6b; margin: 24px 0 0 0; border-top: 1px solid #e5dfd3; padding-top: 16px;">
          <strong>Nota institucional (MIN-008):</strong> Esta encuesta está identificada con tu folio de tamizaje para permitir mejoras en el servicio del departamento de psicología. No se emitirán diagnósticos a partir de este formulario.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background: #f5f1e8; padding: 20px; text-align: center; border-top: 1px solid #e5dfd3; font-size: 11px; color: #6b6b6b;">
        Equilibra TESH · Área de Orientación y Apoyo Psicológico<br/>
        Enviado a través de Resend SMTP (PB-021)
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

Deno.serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido. Solo se acepta POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. VALIDACIÓN DE JWT (Supabase Auth)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Cabecera Authorization faltante. Se requiere token Bearer." }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: "Variables de entorno de Supabase no configuradas en el servidor." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Usuario no autenticado o sesión expirada." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. PARSEO Y VALIDACIÓN DEL BODY
  let payload: EnviarEncuestaPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Cuerpo de solicitud JSON inválido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cleanFolio = typeof payload.folio === "string" ? payload.folio.trim().toUpperCase() : "";
  if (!cleanFolio || cleanFolio.length > 64 || !/^[A-Z0-9_-]+$/.test(cleanFolio)) {
    return new Response(
      JSON.stringify({
        ok: false,
        valido: false,
        error: "El formato del folio institucional es inválido (ejemplo: EQ-9374).",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // 2B. ACCIÓN: VALIDAR PERTENENCIA DE FOLIO AL USER_ID ACTUAL (P0 #9)
  if (payload.action === "validar_folio") {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const staffRoles = new Set(["psicologo", "jefatura", "coordinador", "directivo"]);
      if (profile?.role && staffRoles.has(String(profile.role))) {
        return new Response(
          JSON.stringify({ ok: true, checked: true, valido: true, folio: cleanFolio }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: tamiz } = await supabase
        .from("tamizajes")
        .select("id")
        .eq("folio", cleanFolio)
        .eq("user_id", user.id)
        .maybeSingle();

      if (tamiz) {
        return new Response(
          JSON.stringify({ ok: true, checked: true, valido: true, folio: cleanFolio }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const [{ data: citasByFolio }, { data: citasByTamiz }] = await Promise.all([
        supabase
          .from("solicitudes_cita")
          .select("id, user_id, email")
          .eq("folio", cleanFolio)
          .limit(10),
        supabase
          .from("solicitudes_cita")
          .select("id, user_id, email")
          .eq("folio_tamizaje", cleanFolio)
          .limit(10),
      ]);

      const citas = [...(citasByFolio || []), ...(citasByTamiz || [])];
      const userEmail = user.email?.toLowerCase();
      const ownsCita = citas.some(
        (c) => c.user_id === user.id || (userEmail && c.email?.toLowerCase() === userEmail),
      );

      if (ownsCita) {
        return new Response(
          JSON.stringify({ ok: true, checked: true, valido: true, folio: cleanFolio }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          checked: true,
          valido: false,
          folio: cleanFolio,
          motivo:
            "El folio proporcionado no pertenece a tu cuenta institucional actual (acuerdo MIN-008 / P0 #9).",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (valErr) {
      const msg = valErr instanceof Error ? valErr.message : "Error validando folio";
      return new Response(JSON.stringify({ ok: false, checked: false, error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 3. OBTENCIÓN DE RESEND_API_KEY (exclusiva de Supabase Secrets)
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey || !resendApiKey.startsWith("re_")) {
    console.error("[enviar-encuesta] RESEND_API_KEY no configurada o inválida en secrets.");
    return new Response(
      JSON.stringify({
        error: "RESEND_API_KEY no configurada en los secretos de Supabase.",
        status: "error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // 4. DETERMINAR DESTINATARIO
  let destinoEmail = payload.destinatarioEmail?.trim();
  if (!destinoEmail) {
    // Intentar buscar el email del estudiante por user_id o folio en profiles / solicitudes_cita
    try {
      if (payload.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", payload.user_id)
          .maybeSingle();
        if (prof?.email) destinoEmail = prof.email;
      }
    } catch {
      // Ignorar
    }
  }

  if (!destinoEmail) {
    destinoEmail = `${cleanFolio.toLowerCase().replace(/[^a-z0-9_-]/g, "")}@comunidad.tesh.edu.mx`;
  }

  // 5. ENVÍO DE EMAIL MEDIANTE RESEND API
  const html = generarEmailEncuestaHtml(payload);
  const asunto =
    payload.trigger_tipo === "alta"
      ? `[Equilibra TESH] Encuesta de Satisfacción PB-021 - Folio ${payload.folio}`
      : `[Equilibra TESH] Tu bienestar nos importa: Encuesta breve - Folio ${payload.folio}`;

  let resendMessageId: string | null = null;
  let senderUsed = INSTITUTIONAL_FROM;

  try {
    let res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderUsed,
        to: [destinoEmail],
        subject: asunto,
        html,
      }),
    });

    // Si Resend rechaza por dominio no verificado, reintentar con el remitente de onboarding
    if (!res.ok) {
      const errText = await res.text();
      console.warn(
        `[enviar-encuesta] Resend rechazó remitente ${senderUsed}: ${errText}. Reintentando con ${RESEND_ONBOARDING_FROM}...`,
      );
      senderUsed = RESEND_ONBOARDING_FROM;
      res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: senderUsed,
          to: [destinoEmail],
          subject: asunto,
          html,
        }),
      });

      if (!res.ok) {
        const finalErr = await res.text();
        throw new Error(`Error en Resend API (${res.status}): ${finalErr}`);
      }
    }

    const resJson = await res.json();
    resendMessageId = resJson?.id ?? `msg-${Date.now()}`;
  } catch (emailErr: unknown) {
    const errorMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error("[enviar-encuesta] Error al enviar email vía Resend:", errorMsg);
    return new Response(
      JSON.stringify({
        error: "No se pudo enviar el correo de encuesta a través de Resend.",
        detalle: errorMsg,
        status: "error",
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // 6. REGISTRO EN BD
  try {
    await supabase.from("envios_encuesta").insert({
      folio: payload.folio,
      user_id: payload.user_id || user.id,
      trigger_tipo: payload.trigger_tipo,
      email_destinatario: destinoEmail,
      resend_message_id: resendMessageId,
      enviado_en: new Date().toISOString(),
    });
  } catch {
    // Si la tabla no existe aún, no bloquear respuesta
  }

  return new Response(
    JSON.stringify({
      ok: true,
      status: "enviado",
      mensaje: `Encuesta enviada exitosamente a ${destinoEmail}`,
      folio: payload.folio,
      trigger_tipo: payload.trigger_tipo,
      message_id: resendMessageId,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

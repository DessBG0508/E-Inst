import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? "";
export const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("https://") &&
  supabaseAnonKey.length > 20,
);

function createUnconfiguredQueryBuilder() {
  const result = {
    data: null,
    error: {
      message: "Supabase no configurado (modo demostración local)",
      code: "SUPABASE_UNCONFIGURED",
    },
    count: null,
    status: 503,
    statusText: "Service Unavailable",
  };

  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (
            onFulfilled?: (val: typeof result) => unknown,
            onRejected?: (err: unknown) => unknown,
          ) => Promise.resolve(result).then(onFulfilled, onRejected);
        }
        if (prop === "catch") {
          return (onRejected?: (err: unknown) => unknown) =>
            Promise.resolve(result).catch(onRejected);
        }
        if (prop === "finally") {
          return (onFinally?: () => void) => Promise.resolve(result).finally(onFinally);
        }
        return () => proxy;
      },
    },
  );

  return proxy;
}

function createUnconfiguredChannel() {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: async () => "ok",
  };
  return channel;
}

function createUnconfiguredSupabaseClient(): SupabaseClient {
  const unconfiguredError = {
    message: "Supabase no configurado (modo demostración local)",
    name: "SupabaseUnconfiguredError",
    status: 503,
  };

  const mockClient = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: unconfiguredError,
      }),
      signUp: async () => ({
        data: { user: null, session: null },
        error: unconfiguredError,
      }),
      resetPasswordForEmail: async () => ({
        data: {},
        error: unconfiguredError,
      }),
      verifyOtp: async () => ({
        data: { user: null, session: null },
        error: { ...unconfiguredError, message: "Código incorrecto o expirado" },
      }),
      updateUser: async () => ({
        data: { user: null },
        error: unconfiguredError,
      }),
    },
    from: () => createUnconfiguredQueryBuilder(),
    rpc: () => createUnconfiguredQueryBuilder(),
    functions: {
      invoke: async () => ({
        data: null,
        error: unconfiguredError,
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: unconfiguredError }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
    channel: () => createUnconfiguredChannel(),
    removeChannel: async () => "ok",
  };

  return mockClient as unknown as SupabaseClient;
}

if (!isSupabaseConfigured && typeof console !== "undefined") {
  console.warn(
    "[Equilibra TESH] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no configuradas — operando en modo demostración local.",
  );
}

/**
 * Cliente oficial de Supabase para Equilibra TESH.
 * Gestiona autenticación, base de datos y políticas de seguridad (RLS).
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : createUnconfiguredSupabaseClient();

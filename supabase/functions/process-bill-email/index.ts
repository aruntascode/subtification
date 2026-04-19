import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.1";
import { fallbackDueDate, parseDetectedBill } from "./parser.ts";

type IncomingEmail = {
  messageId?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  receivedAt?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-import-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("BILL_IMPORT_WEBHOOK_SECRET");
  const receivedSecret = req.headers.get("x-import-secret");
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Supabase env vars are missing" }, 500);
  }

  let payload: IncomingEmail;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const recipient = parseRecipient(payload.to);
  if (!recipient) {
    return json({ error: "Import recipient could not be parsed" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: importAddress, error: addressError } = await supabase
    .from("email_import_addresses")
    .select("id,user_id,local_part,is_active")
    .eq("local_part", recipient.localPart)
    .eq("is_active", true)
    .maybeSingle();

  if (addressError) {
    return json({ error: addressError.message }, 500);
  }

  if (!importAddress) {
    return json({ error: "Import address not found" }, 404);
  }

  const sourceMessageId = payload.messageId || buildFallbackMessageId(payload);
  const receivedAt = payload.receivedAt || new Date().toISOString();
  const bodyPreview = (payload.text || stripHtml(payload.html || "")).slice(0, 600);

  const parsed = parseDetectedBill(payload);
  const hasEnoughSignal = parsed.amount !== undefined && parsed.confidence >= 0.45;

  const { error: messageError } = await supabase
    .from("email_import_messages")
    .upsert(
      {
        user_id: importAddress.user_id,
        import_address_id: importAddress.id,
        source_message_id: sourceMessageId,
        from_email: payload.from,
        to_email: payload.to,
        subject: payload.subject,
        received_at: receivedAt,
        body_preview: bodyPreview,
        parsing_status: hasEnoughSignal ? "parsed" : "ignored",
        error: hasEnoughSignal ? null : "No bill amount detected",
      },
      { onConflict: "user_id,source_message_id" },
    );

  if (messageError) {
    return json({ error: messageError.message }, 500);
  }

  if (!hasEnoughSignal || parsed.amount === undefined) {
    return json({ ok: true, detected: false, confidence: parsed.confidence });
  }

  const dueDate = parsed.dueDate || fallbackDueDate(receivedAt);

  const { error: billError } = await supabase
    .from("detected_bills")
    .upsert(
      {
        user_id: importAddress.user_id,
        import_address_id: importAddress.id,
        source_message_id: sourceMessageId,
        provider_key: parsed.providerKey,
        service_name: parsed.serviceName,
        amount: parsed.amount,
        currency: parsed.currency,
        due_date: dueDate,
        billing_cycle: "monthly",
        category: parsed.category,
        status: "pending",
        confidence: parsed.confidence,
        sender_email: payload.from,
        raw_subject: payload.subject,
        received_at: receivedAt,
        parsed_payload: parsed,
      },
      { onConflict: "user_id,source_message_id", ignoreDuplicates: true },
    );

  if (billError) {
    return json({ error: billError.message }, 500);
  }

  return json({
    ok: true,
    detected: true,
    serviceName: parsed.serviceName,
    amount: parsed.amount,
    dueDate,
    confidence: parsed.confidence,
  });
});

function parseRecipient(to?: string) {
  const match = to?.match(/<?([a-z0-9._+-]+)@([^>\s]+)>?/i);
  if (!match) return null;
  const rawLocalPart = match[1].toLowerCase();
  const plusAlias = rawLocalPart.includes("+")
    ? rawLocalPart.split("+").pop()
    : rawLocalPart;
  return {
    localPart: plusAlias || rawLocalPart,
    domain: match[2].toLowerCase(),
  };
}

function buildFallbackMessageId(payload: IncomingEmail) {
  const raw = [
    payload.from ?? "",
    payload.to ?? "",
    payload.subject ?? "",
    payload.receivedAt ?? "",
  ].join("|");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return `fallback-${hash.toString(16)}`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

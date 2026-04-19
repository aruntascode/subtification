export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    const subject = decodeHeader(
      message.headers.get("subject") || readHeader(raw, "subject") || "",
    );
    const messageId =
      message.headers.get("message-id") ||
      readHeader(raw, "message-id") ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bodyStart = raw.search(/\r?\n\r?\n/);
    const body = raw.slice(bodyStart >= 0 ? bodyStart : 0).slice(0, 120000);

    const response = await fetch(
      `${env.SUPABASE_URL}/functions/v1/process-bill-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-import-secret": env.BILL_IMPORT_WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          messageId,
          from: message.from,
          to: message.to,
          subject,
          text: body,
          receivedAt: new Date().toISOString(),
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bill import failed: ${response.status} ${errorText}`);
    }
  },
};

function readHeader(raw, name) {
  const pattern = new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\r?\\n[^\\s]|\\r?\\n\\r?\\n)`, "im");
  const match = raw.match(pattern);
  return match?.[1]?.replace(/\r?\n\s+/g, " ").trim();
}

function decodeHeader(value) {
  return value.replace(/=\?utf-8\?q\?([^?]+)\?=/gi, (_, encoded) =>
    encoded.replace(/_/g, " ").replace(/=([a-f0-9]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
  );
}

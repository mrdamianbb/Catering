type SmsResult = {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
};

function normalizePhone(phone: string) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = `48${digits}`;
  return digits;
}

function cleanSender(v: string | undefined) {
  const s = String(v || "").trim();
  return s ? s.slice(0, 11) : "";
}

export async function sendSms(params: {
  to: string;
  message: string;
  idx?: string;
}): Promise<SmsResult> {
  const token = (process.env.SMSAPI_TOKEN||process.env.sms_api||process.env.SMS_API)?.trim();
  if (!token) {
    return { ok: false, error: "SMSAPI_TOKEN_NOT_CONFIGURED" };
  }

  const to = normalizePhone(params.to);
  if (!/^\d{10,15}$/.test(to)) {
    return { ok: false, error: "INVALID_PHONE" };
  }

  const body = new URLSearchParams({
    to,
    message: params.message.slice(0, 918),
    format: "json",
  });

  const from = cleanSender((process.env.SMSAPI_FROM||process.env.sms_from||process.env.SMS_FROM));
  if (from) body.set("from", from);

  if (params.idx) {
    body.set("idx", params.idx.slice(0, 64));
    body.set("check_idx", "1");
  }

  try {
    const response = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = await response.text().catch(() => null);
    }

    if (!response.ok) {
      return { ok: false, status: response.status, data, error: "SMSAPI_HTTP_ERROR" };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "SMSAPI_NETWORK_ERROR",
    };
  }
}

export type BillCategory = "utilities";

export type ParsedBill = {
  providerKey?: string;
  serviceName: string;
  amount?: number;
  currency: string;
  dueDate?: string;
  category: BillCategory;
  confidence: number;
  matchedTerms: string[];
};

type ParseInput = {
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  receivedAt?: string;
};

type ProviderRule = {
  key: string;
  name: string;
  domains: string[];
  terms: string[];
};

const PROVIDERS: ProviderRule[] = [
  {
    key: "turkcell",
    name: "Turkcell",
    domains: ["turkcell.com.tr", "superonline.net"],
    terms: ["turkcell", "superonline"],
  },
  {
    key: "vodafone",
    name: "Vodafone",
    domains: ["vodafone.com.tr"],
    terms: ["vodafone"],
  },
  {
    key: "turk-telekom",
    name: "Türk Telekom",
    domains: ["turktelekom.com.tr", "ttnet.com.tr"],
    terms: ["turk telekom", "türk telekom", "ttnet"],
  },
  {
    key: "turknet",
    name: "TurkNet",
    domains: ["turk.net", "turknet.net.tr"],
    terms: ["turknet", "turk net"],
  },
  {
    key: "enerjisa",
    name: "Enerjisa",
    domains: ["enerjisa.com.tr"],
    terms: ["enerjisa"],
  },
  {
    key: "iski",
    name: "İSKİ",
    domains: ["iski.istanbul"],
    terms: ["iski", "ıski", "istanbul su"],
  },
  {
    key: "igdas",
    name: "İGDAŞ",
    domains: ["igdas.istanbul"],
    terms: ["igdas", "igdaş", "dogalgaz", "doğalgaz"],
  },
  {
    key: "ck-enerji",
    name: "CK Enerji",
    domains: ["ckenerji.com.tr"],
    terms: ["ck enerji", "bogazici elektrik", "boğaziçi elektrik"],
  },
  {
    key: "izsu",
    name: "İZSU",
    domains: ["izsu.gov.tr"],
    terms: ["izsu", "izmir su"],
  },
  {
    key: "aski",
    name: "ASKİ",
    domains: ["aski.gov.tr"],
    terms: ["aski", "ankara su"],
  },
];

const BILL_TERMS = [
  "fatura",
  "son odeme",
  "son ödeme",
  "odenecek tutar",
  "ödenecek tutar",
  "borcunuz",
  "borcunuz",
  "invoice",
  "bill",
  "due date",
];

const MONTHS: Record<string, string> = {
  ocak: "01",
  january: "01",
  subat: "02",
  şubat: "02",
  february: "02",
  mart: "03",
  march: "03",
  nisan: "04",
  april: "04",
  mayis: "05",
  mayıs: "05",
  may: "05",
  haziran: "06",
  june: "06",
  temmuz: "07",
  july: "07",
  agustos: "08",
  ağustos: "08",
  august: "08",
  eylul: "09",
  eylül: "09",
  september: "09",
  ekim: "10",
  october: "10",
  kasim: "11",
  kasım: "11",
  november: "11",
  aralik: "12",
  aralık: "12",
  december: "12",
};

export function parseDetectedBill(input: ParseInput): ParsedBill {
  const bodyText = normalizeText(
    [
      input.subject ?? "",
      input.text ?? "",
      stripHtml(input.html ?? ""),
    ].join(" "),
  );
  const fromText = normalizeText(input.from ?? "");
  const provider = detectProvider(fromText, bodyText);
  const amount = parseAmount(bodyText);
  const dueDate = parseDueDate(bodyText);
  const matchedTerms = BILL_TERMS.filter((term) =>
    bodyText.includes(normalizeText(term)),
  );

  let confidence = 0.05;
  if (provider) confidence += 0.35;
  if (amount !== undefined) confidence += 0.3;
  if (dueDate) confidence += 0.2;
  if (matchedTerms.length > 0) confidence += 0.1;

  return {
    providerKey: provider?.key,
    serviceName: provider?.name ?? inferServiceName(input.from, input.subject),
    amount,
    currency: "₺",
    dueDate,
    category: "utilities",
    confidence: Math.min(confidence, 0.98),
    matchedTerms,
  };
}

export function fallbackDueDate(receivedAt?: string): string {
  const receivedDate = receivedAt ? new Date(receivedAt) : new Date();
  if (Number.isNaN(receivedDate.getTime())) {
    receivedDate.setTime(Date.now());
  }
  receivedDate.setDate(receivedDate.getDate() + 30);
  return toIsoDateParts(
    receivedDate.getFullYear(),
    receivedDate.getMonth() + 1,
    receivedDate.getDate(),
  );
}

function detectProvider(fromText: string, bodyText: string) {
  const haystack = `${fromText} ${bodyText}`;
  return PROVIDERS.find((provider) => {
    const hasDomain = provider.domains.some((domain) =>
      fromText.includes(normalizeText(domain)),
    );
    const hasTerm = provider.terms.some((term) =>
      haystack.includes(normalizeText(term)),
    );
    return hasDomain || hasTerm;
  });
}

function parseAmount(text: string): number | undefined {
  const amountPatterns = [
    /(?:odenecek|ödenecek|fatura|toplam|borc|borç|tutar|amount|total)[^\d₺]{0,36}₺?\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)\s*(?:tl|try|₺)?/gi,
    /₺\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)/gi,
    /((?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?)\s*(?:tl|try|₺)/gi,
  ];

  for (const pattern of amountPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const value = parseAmountNumber(match[1]);
      if (value !== undefined && value > 0) return value;
    }
  }

  return undefined;
}

function parseAmountNumber(rawValue: string): number | undefined {
  const compact = rawValue.replace(/\s/g, "");
  const normalized =
    compact.includes(",")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact;
  const value = Number(normalized);
  return Number.isFinite(value) ? Number(value.toFixed(2)) : undefined;
}

function parseDueDate(text: string): string | undefined {
  const numericPatterns = [
    /(?:son\s*odeme\s*tarihi|son\s*ödeme\s*tarihi|son\s*odeme|son\s*ödeme|odeme\s*tarihi|ödeme\s*tarihi|due\s*date)[^\d]{0,28}(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/i,
    /(\d{1,2})[./-](\d{1,2})[./-](\d{4})[^\n\r]{0,32}(?:son\s*odeme|son\s*ödeme|due)/i,
  ];

  for (const pattern of numericPatterns) {
    const match = text.match(pattern);
    if (match) {
      return toIsoDate(match[1], match[2], match[3]);
    }
  }

  const namedMatch = text.match(
    /(?:son\s*odeme\s*tarihi|son\s*ödeme\s*tarihi|son\s*odeme|son\s*ödeme|due\s*date)[^\d]{0,28}(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/i,
  );
  if (namedMatch) {
    const month = MONTHS[normalizeText(namedMatch[2])];
    if (month) return toIsoDate(namedMatch[1], month, namedMatch[3]);
  }

  return undefined;
}

function toIsoDate(dayRaw: string, monthRaw: string, yearRaw: string) {
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw);
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return undefined;
  }
  return toIsoDateParts(year, month, day);
}

function toIsoDateParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferServiceName(from?: string, subject?: string) {
  const sender = from?.match(/@([^>\s]+)/)?.[1]?.replace(/^mail\./, "");
  if (sender) return sender.split(".")[0].toUpperCase();
  const firstSubjectWord = subject?.trim().split(/\s+/)[0];
  return firstSubjectWord || "Fatura";
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&ccedil;/g, "ç")
    .replace(/&amp;/g, "&");
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

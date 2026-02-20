export const SUPPORTED_LEGAL_LOCALES = ["en-US", "it-IT", "fr-FR", "de-DE", "es-ES"] as const;

export type SupportedLegalLocale = (typeof SUPPORTED_LEGAL_LOCALES)[number];

export const DEFAULT_LEGAL_LOCALE: SupportedLegalLocale = "en-US";
export const DEFAULT_LEGAL_TIME_ZONE = "UTC";

const LANGUAGE_DEFAULT_LOCALE: Record<string, SupportedLegalLocale> = {
  en: "en-US",
  it: "it-IT",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES"
};

const EN_US_LEGAL_TEXT = {
  "legal.flow.phase2.authenticate_user": "Authenticate user",
  "legal.flow.phase2.ensure_profile_exists": "Ensure profile exists",
  "legal.flow.phase2.capture_baseline_consents": "Capture baseline consents",
  "legal.flow.phase2.create_or_join_gym": "Create or join gym",
  "legal.flow.phase2.set_home_gym": "Set home gym",
  "legal.flow.phase2.load_guild_snapshot": "Load guild hall snapshot",
  "legal.flow.phase3.validate_workout_payload": "Validate workout payload",
  "legal.flow.phase3.validate_required_consents": "Validate required legal consents",
  "legal.flow.phase3.call_log_workout_atomic": "Call log_workout_atomic RPC",
  "legal.flow.phase3.confirm_proof_feed_event": "Confirm proof feed event",
  "legal.flow.phase3.confirm_progress_update": "Confirm XP/rank/chain progress update",
  "legal.flow.phase8.submit_requests": "Submit access/export/delete requests from profile settings",
  "legal.flow.phase8.load_request_timeline": "Load request timeline with status and due date",
  "legal.flow.phase8.load_export_receipts": "Load downloadable export receipts with expiring links",
  "legal.flow.phase8.highlight_overdue_requests": "Highlight overdue open requests for support follow-up",
  "legal.flow.admin.phase8.load_open_requests": "Load open privacy requests for gym members",
  "legal.flow.admin.phase8.highlight_overdue": "Highlight overdue and SLA-breached requests",
  "legal.flow.admin.phase8.transition_status_notes": "Transition request status with auditable notes",
  "legal.flow.admin.phase8.load_queue_filters": "Apply queue filters (status/type/SLA/user)",
  "legal.flow.admin.phase8.show_sla_badges": "Render SLA badges (breached/at risk/on track)",
  "legal.flow.admin.phase8.load_policy_versions": "Load active policy versions and effective dates",
  "legal.flow.admin.phase8.load_privacy_metrics":
    "Load privacy ops metrics (open, overdue, avg completion)",
  "legal.flow.admin.phase8.open_runbook": "Open compliance runbook mapped to queue actions",
  "legal.error.reconsent_required_action": "Legal re-consent is required before this action can continue.",
  "legal.error.reconsent_required_workout": "Legal re-consent is required before workout logging can continue.",
  "legal.error.policy_baseline_missing":
    "Missing active baseline policies for terms, privacy, or health data processing.",
  "legal.error.baseline_consent_required":
    "Terms, privacy, and health-data processing consent are required to continue.",
  "legal.timestamp.not_available": "Not available"
} as const;

export type LegalTranslationKey = keyof typeof EN_US_LEGAL_TEXT;

export interface LegalLocalizationOptions {
  locale?: string | null;
  timeZone?: string | null;
}

export const LEGAL_TRANSLATION_KEYS = Object.freeze(
  Object.keys(EN_US_LEGAL_TEXT)
) as readonly LegalTranslationKey[];

const IT_IT_LEGAL_TEXT: Partial<Record<LegalTranslationKey, string>> = {
  "legal.flow.phase2.authenticate_user": "Autentica utente",
  "legal.flow.phase2.ensure_profile_exists": "Verifica che il profilo esista",
  "legal.flow.phase2.capture_baseline_consents": "Acquisisci i consensi di base",
  "legal.flow.phase2.create_or_join_gym": "Crea o unisciti a una palestra",
  "legal.flow.phase2.set_home_gym": "Imposta palestra principale",
  "legal.flow.phase2.load_guild_snapshot": "Carica snapshot della gilda",
  "legal.flow.phase3.validate_workout_payload": "Valida il payload del workout",
  "legal.flow.phase3.validate_required_consents": "Valida i consensi legali richiesti",
  "legal.flow.phase3.call_log_workout_atomic": "Chiama RPC log_workout_atomic",
  "legal.flow.phase3.confirm_proof_feed_event": "Conferma evento nel Proof Feed",
  "legal.flow.phase3.confirm_progress_update": "Conferma aggiornamento XP/rank/chain",
  "legal.flow.phase8.submit_requests": "Invia richieste access/export/delete dalle impostazioni profilo",
  "legal.flow.phase8.load_request_timeline": "Carica timeline richieste con stato e scadenza",
  "legal.flow.phase8.load_export_receipts": "Carica ricevute export scaricabili con link in scadenza",
  "legal.flow.phase8.highlight_overdue_requests": "Evidenzia richieste aperte scadute per follow-up supporto",
  "legal.flow.admin.phase8.load_open_requests": "Carica richieste privacy aperte dei membri palestra",
  "legal.flow.admin.phase8.highlight_overdue": "Evidenzia richieste scadute e con SLA violata",
  "legal.flow.admin.phase8.transition_status_notes": "Transiziona stato richiesta con note verificabili",
  "legal.flow.admin.phase8.load_queue_filters": "Applica filtri coda (stato/tipo/SLA/utente)",
  "legal.flow.admin.phase8.show_sla_badges": "Mostra badge SLA (violata/a rischio/in linea)",
  "legal.flow.admin.phase8.load_policy_versions": "Carica versioni policy attive e date di efficacia",
  "legal.flow.admin.phase8.load_privacy_metrics":
    "Carica metriche privacy ops (aperte/scadute/tempo medio)",
  "legal.flow.admin.phase8.open_runbook": "Apri runbook compliance collegato alle azioni coda",
  "legal.error.reconsent_required_action": "È richiesto un nuovo consenso legale prima di continuare questa azione.",
  "legal.error.reconsent_required_workout": "È richiesto un nuovo consenso legale prima di registrare il workout.",
  "legal.error.policy_baseline_missing":
    "Mancano policy baseline attive per termini, privacy o trattamento dati salute.",
  "legal.error.baseline_consent_required":
    "Per continuare sono richiesti i consensi a termini, privacy e dati salute.",
  "legal.timestamp.not_available": "Non disponibile"
};

const LEGAL_TRANSLATIONS: Record<SupportedLegalLocale, Partial<Record<LegalTranslationKey, string>>> = {
  "en-US": EN_US_LEGAL_TEXT,
  "it-IT": IT_IT_LEGAL_TEXT,
  "fr-FR": {},
  "de-DE": {},
  "es-ES": {}
};

function normalizeLocaleToken(locale: string): string {
  const normalized = locale.replace("_", "-").trim();
  if (!normalized) {
    return DEFAULT_LEGAL_LOCALE;
  }

  const [languagePart, regionPart] = normalized.split("-");
  const language = (languagePart ?? "").toLowerCase();
  const region = (regionPart ?? "").toUpperCase();

  if (!language) {
    return DEFAULT_LEGAL_LOCALE;
  }

  return region ? `${language}-${region}` : language;
}

function isSupportedLegalLocale(locale: string): locale is SupportedLegalLocale {
  return (SUPPORTED_LEGAL_LOCALES as readonly string[]).includes(locale);
}

export function resolveLegalLocale(locale?: string | null): SupportedLegalLocale {
  if (!locale) {
    return DEFAULT_LEGAL_LOCALE;
  }

  const normalized = normalizeLocaleToken(locale);
  if (isSupportedLegalLocale(normalized)) {
    return normalized;
  }

  const language = normalized.split("-")[0] ?? "";
  return LANGUAGE_DEFAULT_LOCALE[language] ?? DEFAULT_LEGAL_LOCALE;
}

export function legalLocaleFallbackChain(locale?: string | null): SupportedLegalLocale[] {
  const primary = resolveLegalLocale(locale);
  if (primary === DEFAULT_LEGAL_LOCALE) {
    return [DEFAULT_LEGAL_LOCALE];
  }

  return [primary, DEFAULT_LEGAL_LOCALE];
}

export function translateLegalText(
  key: LegalTranslationKey,
  options: Pick<LegalLocalizationOptions, "locale"> = {}
): string {
  const fallbackChain = legalLocaleFallbackChain(options.locale);

  for (const locale of fallbackChain) {
    const translated = LEGAL_TRANSLATIONS[locale]?.[key];
    if (translated) {
      return translated;
    }
  }

  return EN_US_LEGAL_TEXT[key];
}

export function resolveLegalTimeZone(timeZone?: string | null): string {
  if (!timeZone || !timeZone.trim()) {
    return DEFAULT_LEGAL_TIME_ZONE;
  }

  const candidate = timeZone.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return DEFAULT_LEGAL_TIME_ZONE;
  }
}

export function formatLegalTimestamp(
  value: string | number | Date | null | undefined,
  options: LegalLocalizationOptions = {}
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const locale = resolveLegalLocale(options.locale);
  const timeZone = resolveLegalTimeZone(options.timeZone);

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  }).format(date);
}

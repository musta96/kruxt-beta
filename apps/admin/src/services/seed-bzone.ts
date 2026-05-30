import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Seeds a gym with realistic demo data based on BZone Fitness (Pavia, Italy).
 * Owner: Tommaso Di Genua. Source: bzonefitness.it
 *
 * Idempotent for plans + waiver (unique constraints + onConflict). Classes are
 * skipped if any already exist for the gym to avoid duplicating the schedule.
 */

export interface SeedResult {
  gymUpdated: boolean;
  plansUpserted: number;
  classesCreated: number;
  classesSkipped: boolean;
  waiverUpserted: boolean;
  brandSettingsUpserted: boolean;
  billingSettingsUpserted: boolean;
  demoPeople: DemoPeopleSeedResult;
}

export interface DemoPeopleSeedResult {
  authUsersUpserted: number;
  profilesUpserted: number;
  membershipsUpserted: number;
  joinRequestsUpserted: number;
  staffShiftsCreated: number;
  workoutPlansCreated: number;
  classesAssigned: number;
}

interface PlanSeed {
  name: string;
  billing_cycle: "monthly" | "quarterly" | "yearly" | "dropin";
  price_cents: number;
  currency: string;
  cancel_policy: string;
}

const BZONE_GYM_PROFILE = {
  slug: "bzone-fitness-pavia",
  name: "BZone Fitness",
  motto: "La Palestra del Borgo",
  description:
    "BZONE Fitness a Borgo Ticino, Pavia: sala pesi, corsi fitness, personal training e percorsi per il benessere personale.",
  city: "Pavia",
  countryCode: "IT",
  timezone: "Europe/Rome"
};

const BZONE_BRAND_SETTINGS = {
  app_display_name: "BZone Fitness",
  primary_color: "#35D0FF",
  accent_color: "#8BE9C7",
  background_color: "#0E1116",
  surface_color: "#171C24",
  text_color: "#F5F7FA",
  launch_screen_message: "La salute e il bene piu importante.",
  support_email: "info@bzonefitness.it",
  terms_url: "https://www.bzonefitness.it/bzone_gdpr/",
  privacy_url: "https://www.bzonefitness.it/bzone_gdpr/",
  metadata: {
    website: "https://www.bzonefitness.it/",
    address: "Via Magenta, 8 - Borgo Ticino, 27100 Pavia (PV)",
    phone: "0382 25146",
    openingHours: {
      weekdays: "07:00/22:00",
      saturday: "09:00/17:00",
      sunday: "09:00/14:00"
    }
  }
};

const BZONE_PLANS: PlanSeed[] = [
  {
    name: "Action Light",
    billing_cycle: "monthly",
    price_cents: 5000,
    currency: "EUR",
    cancel_policy: "Accesso illimitato Sala Pesi e Cardio.",
  },
  {
    name: "Action Medium",
    billing_cycle: "monthly",
    price_cents: 6000,
    currency: "EUR",
    cancel_policy: "Light + scheda allenamento personalizzata cartacea.",
  },
  {
    name: "Action Top",
    billing_cycle: "yearly",
    price_cents: 90000,
    currency: "EUR",
    cancel_policy: "Light + scheda + piano alimentare.",
  },
  {
    name: "Fit",
    billing_cycle: "monthly",
    price_cents: 5000,
    currency: "EUR",
    cancel_policy: "Accesso illimitato Corsi Fitness.",
  },
  {
    name: "Perfect",
    billing_cycle: "monthly",
    price_cents: 6500,
    currency: "EUR",
    cancel_policy: "Sala Pesi light + Corsi Fitness illimitati.",
  },
  {
    name: "University",
    billing_cycle: "monthly",
    price_cents: 4500,
    currency: "EUR",
    cancel_policy: "Per studenti universitari (Sala Pesi light o Corsi Fitness).",
  },
  {
    name: "DodiciSedici",
    billing_cycle: "monthly",
    price_cents: 3500,
    currency: "EUR",
    cancel_policy: "Sala pesi in fascia oraria 12:00 - 16:00.",
  },
  {
    name: "Spartan F.T.",
    billing_cycle: "monthly",
    price_cents: 5500,
    currency: "EUR",
    cancel_policy: "Accesso illimitato alle lezioni Spartan Functional Training.",
  },
  {
    name: "Free Card 2 Corsi",
    billing_cycle: "monthly",
    price_cents: 8500,
    currency: "EUR",
    cancel_policy: "Due corsi a scelta.",
  },
  {
    name: "One Drop-in",
    billing_cycle: "dropin",
    price_cents: 1200,
    currency: "EUR",
    cancel_policy: "Singolo ingresso senza iscrizione.",
  },
];

interface ClassTemplate {
  weekday: number; // 1=Monday through 6=Saturday (matches Date.getDay())
  start: string; // "HH:mm"
  end: string;
  title: string;
  description: string;
  capacity: number;
}

const BZONE_CLASSES: ClassTemplate[] = [
  // Monday
  { weekday: 1, start: "09:30", end: "10:30", title: "Pilates Mattina", description: "Pilates matwork, postura e core.", capacity: 12 },
  { weekday: 1, start: "18:00", end: "19:00", title: "Functional Training", description: "Allenamento funzionale a corpo libero e con piccoli attrezzi.", capacity: 15 },
  { weekday: 1, start: "19:30", end: "20:30", title: "Tone UP", description: "Lezione di tonificazione full-body.", capacity: 20 },
  // Tuesday
  { weekday: 2, start: "10:00", end: "11:00", title: "ABS Stretch", description: "Addominali e stretching.", capacity: 20 },
  { weekday: 2, start: "18:00", end: "19:00", title: "G.A.G.", description: "Gambe, Addominali, Glutei.", capacity: 20 },
  { weekday: 2, start: "19:30", end: "20:30", title: "Pilates", description: "Pilates matwork, postura e core.", capacity: 12 },
  // Wednesday
  { weekday: 3, start: "12:30", end: "13:30", title: "The Circuit Lunch", description: "Circuit training in pausa pranzo.", capacity: 15 },
  { weekday: 3, start: "18:00", end: "19:00", title: "Strong Cardio", description: "Cardio intensivo con musica.", capacity: 15 },
  { weekday: 3, start: "19:30", end: "20:30", title: "The Circuit", description: "Circuit training ad alta intensita.", capacity: 15 },
  // Thursday
  { weekday: 4, start: "10:00", end: "11:00", title: "Pilates Mattina", description: "Pilates matwork.", capacity: 12 },
  { weekday: 4, start: "18:00", end: "19:00", title: "ABS Stretch", description: "Addominali e stretching.", capacity: 20 },
  { weekday: 4, start: "19:30", end: "20:30", title: "Spartan Functional Training", description: "Functional intenso stile Spartan Race.", capacity: 12 },
  // Friday
  { weekday: 5, start: "09:30", end: "10:30", title: "Tone UP Mattina", description: "Tonificazione mattutina.", capacity: 20 },
  { weekday: 5, start: "18:00", end: "19:00", title: "Functional Training", description: "Allenamento funzionale.", capacity: 15 },
  { weekday: 5, start: "19:30", end: "20:30", title: "G.A.G.", description: "Gambe, Addominali, Glutei.", capacity: 20 },
  // Saturday
  { weekday: 6, start: "10:00", end: "11:00", title: "Tone UP", description: "Tonificazione del sabato mattina.", capacity: 20 },
  { weekday: 6, start: "11:15", end: "12:15", title: "Functional Training", description: "Functional weekend.", capacity: 15 },
];

function nextOrSameWeekday(targetWeekday: number, base: Date): Date {
  const d = new Date(base);
  const diff = (targetWeekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function buildClassTime(weekday: number, hhmm: string, weekOffset: number, base: Date): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = nextOrSameWeekday(weekday, base);
  d.setDate(d.getDate() + weekOffset * 7);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const NUM_WEEKS = 4;

const BZONE_MANUAL_BILLING = {
  instructions:
    "Pay by bank transfer or at reception. Staff will confirm the membership after the payment is recorded.",
  bankAccountLabel: "BZone demo billing account",
  accountHolder: "BZone Fitness",
  iban: "IT00X0000000000000000000000",
  paymentReferenceFormat: "KRUXT {member name} {invoice id}",
  cashDeskNote: "Cash and POS payments can be made at reception during staffed hours.",
  externalPaymentUrl: "https://www.bzonefitness.it/contatti/"
};

function numberFromRecord(record: Record<string, unknown>, key: keyof DemoPeopleSeedResult): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeDemoPeopleSeed(value: unknown): DemoPeopleSeedResult {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    authUsersUpserted: numberFromRecord(record, "authUsersUpserted"),
    profilesUpserted: numberFromRecord(record, "profilesUpserted"),
    membershipsUpserted: numberFromRecord(record, "membershipsUpserted"),
    joinRequestsUpserted: numberFromRecord(record, "joinRequestsUpserted"),
    staffShiftsCreated: numberFromRecord(record, "staffShiftsCreated"),
    workoutPlansCreated: numberFromRecord(record, "workoutPlansCreated"),
    classesAssigned: numberFromRecord(record, "classesAssigned")
  };
}

export async function seedBzoneDemoData(
  supabase: SupabaseClient,
  gymId: string
): Promise<SeedResult> {
  // 1. Canonical BZone identity for the selected test gym.
  const { error: gymError } = await supabase
    .from("gyms")
    .update({
      slug: BZONE_GYM_PROFILE.slug,
      name: BZONE_GYM_PROFILE.name,
      motto: BZONE_GYM_PROFILE.motto,
      description: BZONE_GYM_PROFILE.description,
      city: BZONE_GYM_PROFILE.city,
      country_code: BZONE_GYM_PROFILE.countryCode,
      timezone: BZONE_GYM_PROFILE.timezone,
      is_public: true
    })
    .eq("id", gymId);
  if (gymError) throw new Error(`Gym profile: ${gymError.message}`);

  const { error: brandError } = await supabase.from("gym_brand_settings").upsert(
    {
      gym_id: gymId,
      ...BZONE_BRAND_SETTINGS
    },
    { onConflict: "gym_id" }
  );
  if (brandError) throw new Error(`Brand settings: ${brandError.message}`);

  // 2. Membership plans (idempotent; unique on gym_id+name)
  const planRows = BZONE_PLANS.map((p) => ({
    gym_id: gymId,
    name: p.name,
    billing_cycle: p.billing_cycle,
    price_cents: p.price_cents,
    currency: p.currency,
    cancel_policy: p.cancel_policy,
    is_active: true,
  }));

  const { error: planError } = await supabase
    .from("gym_membership_plans")
    .upsert(planRows, { onConflict: "gym_id,name" });
  if (planError) throw new Error(`Plans: ${planError.message}`);

  // 3. Classes: only insert if no classes exist yet (avoids duplicating the
  // weekly grid every time someone hits the seed button).
  const { count: existingClassCount, error: countError } = await supabase
    .from("gym_classes")
    .select("id", { head: true, count: "exact" })
    .eq("gym_id", gymId)
    .neq("status", "cancelled")
    .gte("starts_at", new Date().toISOString());
  if (countError) throw new Error(`Class count: ${countError.message}`);

  let classesCreated = 0;
  let classesSkipped = false;

  if ((existingClassCount ?? 0) > 0) {
    classesSkipped = true;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const classRows: Record<string, unknown>[] = [];
    for (let weekOffset = 0; weekOffset < NUM_WEEKS; weekOffset++) {
      for (const c of BZONE_CLASSES) {
        classRows.push({
          gym_id: gymId,
          title: c.title,
          description: c.description,
          capacity: c.capacity,
          status: "scheduled",
          starts_at: buildClassTime(c.weekday, c.start, weekOffset, today),
          ends_at: buildClassTime(c.weekday, c.end, weekOffset, today),
        });
      }
    }
    const { error: classError } = await supabase.from("gym_classes").insert(classRows);
    if (classError) throw new Error(`Classes: ${classError.message}`);
    classesCreated = classRows.length;
  }

  // 4. Waiver (idempotent; unique on gym_id+title+policy_version)
  const { error: waiverError } = await supabase.from("waivers").upsert(
    {
      gym_id: gymId,
      title: "Liberatoria salute e responsabilita",
      policy_version: "v1.0",
      language_code: "it",
      document_url: "https://www.bzonefitness.it/bzone_gdpr/",
      is_active: true,
    },
    { onConflict: "gym_id,title,policy_version" }
  );
  if (waiverError) throw new Error(`Waiver: ${waiverError.message}`);

  // 5. Manual billing instructions shown beside open member invoices.
  const { error: billingError } = await supabase.from("gym_feature_settings").upsert(
    {
      gym_id: gymId,
      feature_key: "manual_billing",
      enabled: true,
      rollout_percentage: 100,
      config: BZONE_MANUAL_BILLING,
      note: "BZone demo manual payment instructions"
    },
    { onConflict: "gym_id,feature_key" }
  );
  if (billingError) throw new Error(`Billing settings: ${billingError.message}`);

  // 6. Demo people are seeded in the database so profiles can satisfy the
  // auth.users foreign key without exposing privileged credentials to the app.
  const { data: demoPeopleData, error: demoPeopleError } = await supabase.rpc("seed_bzone_demo_people", {
    p_gym_id: gymId
  });
  if (demoPeopleError) throw new Error(`Demo people: ${demoPeopleError.message}`);

  return {
    gymUpdated: true,
    plansUpserted: planRows.length,
    classesCreated,
    classesSkipped,
    waiverUpserted: true,
    brandSettingsUpserted: true,
    billingSettingsUpserted: true,
    demoPeople: normalizeDemoPeopleSeed(demoPeopleData),
  };
}

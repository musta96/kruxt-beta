import type { BookingStatus, MembershipStatus, WaitlistStatus } from "@kruxt/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type GymRow = {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
};

type MembershipRow = {
  membership_status: MembershipStatus;
};

type GymClassRow = {
  id: string;
  gym_id: string;
  title: string;
  description: string | null;
  capacity: number;
  status: "scheduled" | "cancelled" | "completed";
  starts_at: string;
  ends_at: string;
  booking_opens_at: string | null;
  booking_closes_at: string | null;
};

type BookingRow = {
  id: string;
  class_id: string;
  status: BookingStatus;
};

type WaitlistRow = {
  id: string;
  class_id: string;
  position: number;
  status: WaitlistStatus;
};

export interface MemberGymClass {
  id: string;
  gymId: string;
  title: string;
  description: string | null;
  capacity: number;
  status: GymClassRow["status"];
  startsAt: string;
  endsAt: string;
  bookingOpensAt: string | null;
  bookingClosesAt: string | null;
  booking: { id: string; status: BookingStatus } | null;
  waitlist: { id: string; position: number; status: WaitlistStatus } | null;
}

export interface GymClassSchedule {
  gym: {
    id: string;
    name: string;
    city: string | null;
    countryCode: string | null;
  };
  membershipStatus: MembershipStatus | null;
  classes: MemberGymClass[];
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }
  return data.user.id;
}

export async function loadGymClassSchedule(
  client: SupabaseClient,
  gymId: string
): Promise<GymClassSchedule> {
  const userId = await requireUserId(client);
  const nowIso = new Date().toISOString();

  const [gymResponse, membershipResponse, classesResponse] = await Promise.all([
    client.from("gyms").select("id,name,city,country_code").eq("id", gymId).maybeSingle(),
    client
      .from("gym_memberships")
      .select("membership_status")
      .eq("gym_id", gymId)
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("gym_classes")
      .select("id,gym_id,title,description,capacity,status,starts_at,ends_at,booking_opens_at,booking_closes_at")
      .eq("gym_id", gymId)
      .eq("status", "scheduled")
      .gte("ends_at", nowIso)
      .order("starts_at", { ascending: true })
  ]);

  if (gymResponse.error) {
    throw new Error(gymResponse.error.message || "Unable to load this gym.");
  }
  if (membershipResponse.error) {
    throw new Error(membershipResponse.error.message || "Unable to load gym membership.");
  }
  if (classesResponse.error) {
    throw new Error(classesResponse.error.message || "Unable to load gym classes.");
  }
  if (!gymResponse.data) {
    throw new Error("Gym not found or unavailable to this account.");
  }

  const classRows = (classesResponse.data ?? []) as GymClassRow[];
  const classIds = classRows.map((gymClass) => gymClass.id);
  let bookingRows: BookingRow[] = [];
  let waitlistRows: WaitlistRow[] = [];

  if (classIds.length > 0) {
    const [bookingsResponse, waitlistResponse] = await Promise.all([
      client
        .from("class_bookings")
        .select("id,class_id,status")
        .eq("user_id", userId)
        .in("class_id", classIds),
      client
        .from("class_waitlist")
        .select("id,class_id,position,status")
        .eq("user_id", userId)
        .in("class_id", classIds)
    ]);

    if (bookingsResponse.error) {
      throw new Error(bookingsResponse.error.message || "Unable to load your class bookings.");
    }
    if (waitlistResponse.error) {
      throw new Error(waitlistResponse.error.message || "Unable to load your waitlists.");
    }

    bookingRows = (bookingsResponse.data ?? []) as BookingRow[];
    waitlistRows = (waitlistResponse.data ?? []) as WaitlistRow[];
  }

  const bookingsByClass = new Map(bookingRows.map((booking) => [booking.class_id, booking]));
  const waitlistByClass = new Map(waitlistRows.map((entry) => [entry.class_id, entry]));
  const gym = gymResponse.data as GymRow;

  return {
    gym: {
      id: gym.id,
      name: gym.name,
      city: gym.city,
      countryCode: gym.country_code
    },
    membershipStatus: (membershipResponse.data as MembershipRow | null)?.membership_status ?? null,
    classes: classRows.map((gymClass) => {
      const booking = bookingsByClass.get(gymClass.id);
      const waitlist = waitlistByClass.get(gymClass.id);
      return {
        id: gymClass.id,
        gymId: gymClass.gym_id,
        title: gymClass.title,
        description: gymClass.description,
        capacity: gymClass.capacity,
        status: gymClass.status,
        startsAt: gymClass.starts_at,
        endsAt: gymClass.ends_at,
        bookingOpensAt: gymClass.booking_opens_at,
        bookingClosesAt: gymClass.booking_closes_at,
        booking: booking ? { id: booking.id, status: booking.status } : null,
        waitlist: waitlist
          ? { id: waitlist.id, position: waitlist.position, status: waitlist.status }
          : null
      };
    })
  };
}

export async function bookGymClass(
  client: SupabaseClient,
  input: { classId: string }
): Promise<string> {
  await requireUserId(client);
  const { data, error } = await client.rpc("book_gym_class", { p_class_id: input.classId });

  if (error) {
    throw new Error(error.message || "Unable to book this class.");
  }
  return String(data);
}

export async function cancelGymClassBooking(
  client: SupabaseClient,
  input: { bookingId: string }
): Promise<void> {
  const userId = await requireUserId(client);
  const { data, error } = await client
    .from("class_bookings")
    .update({ status: "cancelled" })
    .eq("id", input.bookingId)
    .eq("user_id", userId)
    .in("status", ["booked", "waitlisted"])
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to cancel this booking.");
  }
  if (!data) {
    throw new Error("This booking is no longer available to cancel.");
  }
}

export async function joinGymClassWaitlist(
  client: SupabaseClient,
  input: { classId: string }
): Promise<string> {
  await requireUserId(client);
  const { data, error } = await client.rpc("join_waitlist", { p_class_id: input.classId });
  if (error) {
    throw new Error(error.message || "Unable to join this class waitlist.");
  }
  return String(data);
}

export async function leaveGymClassWaitlist(
  client: SupabaseClient,
  input: { waitlistId: string }
): Promise<void> {
  const userId = await requireUserId(client);
  const { data, error } = await client
    .from("class_waitlist")
    .update({ status: "cancelled" })
    .eq("id", input.waitlistId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to leave this waitlist.");
  }
  if (!data) {
    throw new Error("This waitlist entry is no longer active.");
  }
}

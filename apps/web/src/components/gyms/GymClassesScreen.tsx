"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MemberShell } from "@/components/public/MemberShell";
import { usePublicSession } from "@/components/public/usePublicSession";
import {
  bookGymClass,
  cancelGymClassBooking,
  joinGymClassWaitlist,
  leaveGymClassWaitlist,
  loadGymClassSchedule,
  type GymClassSchedule,
  type MemberGymClass
} from "@/lib/public/classes";

function formatClassDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDuration(startsAt: string, endsAt: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000));
  return `${minutes} min`;
}

function hasEligibleMembership(schedule: GymClassSchedule | null): boolean {
  return schedule?.membershipStatus === "active" || schedule?.membershipStatus === "trial";
}

function bookingWindowLabel(gymClass: MemberGymClass, now: number): string {
  if (gymClass.booking?.status === "booked" || gymClass.booking?.status === "attended") {
    return gymClass.booking.status === "attended" ? "Attended" : "Booked";
  }
  if (gymClass.booking?.status === "no_show") return "No show";
  if (gymClass.booking?.status === "waitlisted") return "Waitlisted";
  if (gymClass.waitlist?.status === "pending") {
    return `Waitlist #${gymClass.waitlist.position}`;
  }

  if (!gymClass.bookingOpensAt || !gymClass.bookingClosesAt) return "Booking unavailable";
  const opensAt = Date.parse(gymClass.bookingOpensAt);
  const closesAt = Date.parse(gymClass.bookingClosesAt);
  if (now < opensAt) return `Opens ${formatClassDate(gymClass.bookingOpensAt)}`;
  if (now > closesAt) return "Booking closed";
  return "Booking open";
}

function isBookingWindowOpen(gymClass: MemberGymClass, now: number): boolean {
  if (!gymClass.bookingOpensAt || !gymClass.bookingClosesAt) return false;
  const opensAt = Date.parse(gymClass.bookingOpensAt);
  const closesAt = Date.parse(gymClass.bookingClosesAt);
  return gymClass.status === "scheduled" && now >= opensAt && now <= closesAt;
}

export function GymClassesScreen({ gymId }: { gymId: string }) {
  const { state, supabase } = usePublicSession();
  const [schedule, setSchedule] = useState<GymClassSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionClassId, setActionClassId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const now = useMemo(() => Date.now(), []);

  const loadSchedule = useCallback(async () => {
    if (!state.user) return;
    setLoading(true);
    setError(null);
    try {
      setSchedule(await loadGymClassSchedule(supabase, gymId));
    } catch (loadError) {
      setSchedule(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load this class schedule.");
    } finally {
      setLoading(false);
    }
  }, [gymId, state.user, supabase]);

  useEffect(() => {
    if (state.status !== "ready" || !state.user) return;
    void loadSchedule();
  }, [loadSchedule, state.status, state.user]);

  const runAction = useCallback(
    async (gymClass: MemberGymClass, action: () => Promise<unknown>, successMessage: string) => {
      setActionClassId(gymClass.id);
      setError(null);
      setSuccess(null);
      try {
        await action();
        setSuccess(successMessage);
        await loadSchedule();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Unable to update this class.");
      } finally {
        setActionClassId(null);
      }
    },
    [loadSchedule]
  );

  const location = schedule
    ? [schedule.gym.city, schedule.gym.countryCode].filter(Boolean).join(", ")
    : "";
  const eligibleMember = hasEligibleMembership(schedule);

  return (
    <MemberShell
      title={schedule?.gym.name ? `${schedule.gym.name} classes` : "Gym classes"}
      subtitle="Sign in to inspect the live schedule, book a class, or join its waitlist."
    >
      <section className="gym-discovery-panel">
        <div className="profile-form-header">
          <div>
            <p className="feed-meta">{location || "Member schedule"}</p>
            <h2 className="section-title">Upcoming classes</h2>
            <p className="section-copy">
              {eligibleMember
                ? `Your ${schedule?.membershipStatus} membership can book during each class window.`
                : "An active or trial membership is required to book or join a waitlist."}
            </p>
          </div>
          <div className="stack-actions">
            <Link href="/gyms" className="secondary-cta">Back to gyms</Link>
            <button type="button" className="ghost-chip" onClick={() => void loadSchedule()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {error ? <div className="status-banner status-danger" role="alert">{error}</div> : null}
        {success ? <div className="status-banner status-success" role="status">{success}</div> : null}
      </section>

      {loading ? (
        <section className="section-stack">
          <article className="feed-card"><p className="feed-body">Loading class schedule...</p></article>
        </section>
      ) : !schedule || schedule.classes.length === 0 ? (
        <section className="section-stack">
          <article className="feed-card">
            <p className="feed-title">No upcoming classes</p>
            <p className="feed-body">This gym has not published any future scheduled classes yet.</p>
          </article>
        </section>
      ) : (
        <section className="gym-card-list">
          {schedule.classes.map((gymClass) => {
            const activeBooking = gymClass.booking?.status === "booked";
            const completedBooking = gymClass.booking?.status === "attended" || gymClass.booking?.status === "no_show";
            const activeWaitlist = gymClass.waitlist?.status === "pending" || gymClass.booking?.status === "waitlisted";
            const windowOpen = isBookingWindowOpen(gymClass, now);
            const acting = actionClassId === gymClass.id;

            return (
              <article key={gymClass.id} className="gym-directory-card">
                <div className="feed-card-header">
                  <div>
                    <p className="feed-meta">{formatClassDate(gymClass.startsAt)} · {formatDuration(gymClass.startsAt, gymClass.endsAt)}</p>
                    <h2 className="section-title">{gymClass.title}</h2>
                    <p className="section-copy">{gymClass.description || "No class description provided."}</p>
                  </div>
                  <span className="ghost-chip">{bookingWindowLabel(gymClass, now)}</span>
                </div>

                <div className="feed-stat-row">
                  <span className="ghost-chip">Capacity {gymClass.capacity}</span>
                  <span className="ghost-chip">
                    Closes {formatClassDate(gymClass.bookingClosesAt ?? gymClass.startsAt)}
                  </span>
                </div>

                <div className="plan-action-bar">
                  {activeBooking ? (
                    <button
                      type="button"
                      className="secondary-cta"
                      disabled={actionClassId !== null}
                      onClick={() => void runAction(
                        gymClass,
                        () => cancelGymClassBooking(supabase, { bookingId: gymClass.booking!.id }),
                        `${gymClass.title} booking cancelled.`
                      )}
                    >
                      {acting ? "Updating..." : "Cancel booking"}
                    </button>
                  ) : activeWaitlist ? (
                    <button
                      type="button"
                      className="secondary-cta"
                      disabled={actionClassId !== null}
                      onClick={() => void runAction(
                        gymClass,
                        () => gymClass.waitlist?.status === "pending"
                          ? leaveGymClassWaitlist(supabase, { waitlistId: gymClass.waitlist.id })
                          : cancelGymClassBooking(supabase, { bookingId: gymClass.booking!.id }),
                        `You left the ${gymClass.title} waitlist.`
                      )}
                    >
                      {acting ? "Updating..." : "Leave waitlist"}
                    </button>
                  ) : completedBooking ? null : (
                    <>
                      <button
                        type="button"
                        className="primary-cta"
                        disabled={!eligibleMember || !windowOpen || actionClassId !== null}
                        onClick={() => void runAction(
                          gymClass,
                          () => bookGymClass(supabase, { classId: gymClass.id }),
                          `${gymClass.title} booked.`
                        )}
                      >
                        {acting ? "Booking..." : "Book class"}
                      </button>
                      <button
                        type="button"
                        className="secondary-cta"
                        disabled={!eligibleMember || !windowOpen || actionClassId !== null}
                        onClick={() => void runAction(
                          gymClass,
                          () => joinGymClassWaitlist(supabase, { classId: gymClass.id }),
                          `You joined the ${gymClass.title} waitlist.`
                        )}
                      >
                        Join waitlist
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </MemberShell>
  );
}

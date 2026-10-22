"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClassBooking, ClassWaitlistEntry } from "@kruxt/types";

export interface LoadedClassDetail {
  gymId: string;
  classId: string;
  bookings: ClassBooking[];
  waitlist: ClassWaitlistEntry[];
}

interface ClassDetailResult {
  status: "idle" | "loading" | "success" | "error";
  data: LoadedClassDetail | undefined;
  error: string | undefined;
  refetch: () => void;
}

type ClassDetailLoader = (
  gymId: string,
  classId: string
) => Promise<Pick<LoadedClassDetail, "bookings" | "waitlist">>;

export function useClassDetail(
  gymId: string,
  classId: string | null,
  load: ClassDetailLoader
): ClassDetailResult {
  const [status, setStatus] = useState<ClassDetailResult["status"]>("idle");
  const [data, setData] = useState<LoadedClassDetail | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [stateKey, setStateKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requestIdRef = useRef(0);

  const refetch = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const requestKey = classId ? `${gymId}:${classId}` : null;
    let active = true;

    if (!gymId || !classId) {
      setStateKey(null);
      setStatus("idle");
      setData(undefined);
      setError(undefined);
      return;
    }

    setStateKey(requestKey);
    setStatus("loading");
    setData(undefined);
    setError(undefined);

    void load(gymId, classId)
      .then((result) => {
        if (!active || requestId !== requestIdRef.current) return;
        setData({ gymId, classId, ...result });
        setStatus("success");
      })
      .catch((loadError: unknown) => {
        if (!active || requestId !== requestIdRef.current) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load class details.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [classId, gymId, load, revision]);

  const currentKey = classId ? `${gymId}:${classId}` : null;
  const matchesCurrentRequest = stateKey === currentKey;
  const matchesCurrentSelection = data?.gymId === gymId && data.classId === classId;

  return {
    status: matchesCurrentRequest ? status : classId ? "loading" : "idle",
    data: matchesCurrentRequest && matchesCurrentSelection ? data : undefined,
    error: matchesCurrentRequest ? error : undefined,
    refetch
  };
}

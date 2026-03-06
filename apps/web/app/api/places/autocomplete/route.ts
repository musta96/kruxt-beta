import { NextResponse } from "next/server";

interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const mode = searchParams.get("mode") === "address" ? "address" : "establishment";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ suggestions: [], error: "google_key_missing" }, { status: 503 });
  }

  const params = new URLSearchParams({
    input: q,
    key: apiKey,
    types: mode === "address" ? "address" : "establishment"
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { suggestions: [], error: `google_http_${response.status}` },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as {
      status?: string;
      predictions?: GooglePrediction[];
      error_message?: string;
    };

    if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { suggestions: [], error: payload.error_message ?? payload.status },
        { status: 502 }
      );
    }

    const suggestions = (payload.predictions ?? []).slice(0, 8).map((item) => ({
      placeId: item.place_id,
      description: item.description,
      mainText: item.structured_formatting?.main_text ?? "",
      secondaryText: item.structured_formatting?.secondary_text ?? ""
    }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json(
      { suggestions: [], error: error instanceof Error ? error.message : "places_lookup_failed" },
      { status: 500 }
    );
  }
}

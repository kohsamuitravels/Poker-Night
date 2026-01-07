import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function nextIndex(i: number, n: number) {
  return (i + 1) % n;
}

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    // 1) Auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Role
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      return NextResponse.json(
        { error: "Profile read failed", details: profileErr.message },
        { status: 500 }
      );
    }

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Body
    const body = await req.json().catch(() => null);
    const tableId: string | undefined = body?.tableId;

    if (!tableId) {
      return NextResponse.json({ error: "Missing tableId" }, { status: 400 });
    }

    // 4) Get running session SAFELY (no .single())
    const { data: runningSessions, error: sessionErr } = await supabase
      .from("table_sessions")
      .select("id, dealer_user_id, status, started_at")
      .eq("table_id", tableId)
      .eq("status", "running")
      .order("started_at", { ascending: false });

    if (sessionErr) {
      return NextResponse.json(
        { error: "Session read failed", details: sessionErr.message },
        { status: 500 }
      );
    }

    if (!runningSessions || runningSessions.length === 0) {
      return NextResponse.json(
        { error: "No running session for this table" },
        { status: 400 }
      );
    }

    // אם יש כמה running - אל תמשיכי כאילו הכל בסדר
    if (runningSessions.length > 1) {
      return NextResponse.json(
        {
          error: "Multiple running sessions found (DB is inconsistent)",
          running_count: runningSessions.length,
          latest_session_id: runningSessions[0].id,
        },
        { status: 409 }
      );
    }

    const session = runningSessions[0];

    // 5) Members joined
    const { data: members, error: membersErr } = await supabase
      .from("table_members")
      .select("user_id, seat, joined_at")
      .eq("table_id", tableId)
      .eq("status", "joined");

    if (membersErr) {
      return NextResponse.json(
        { error: "Members read failed", details: membersErr.message },
        { status: 500 }
      );
    }

    if (!members || members.length < 4) {
      return NextResponse.json(
        { error: "Need at least 4 joined players", joined: members?.length ?? 0 },
        { status: 400 }
      );
    }

    // 6) Order: seat if possible else joined_at
    const seatedCount = members.filter((m) => m.seat !== null && m.seat !== undefined).length;
    const useSeats = seatedCount >= 4;

    const ordered = [...members].sort((a, b) => {
      if (useSeats) {
        const aSeat = (a.seat ?? 999999) as number;
        const bSeat = (b.seat ?? 999999) as number;
        return aSeat - bSeat;
      }

      const aTime = a.joined_at ? new Date(a.joined_at as any).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.joined_at ? new Date(b.joined_at as any).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    const players = Array.from(new Set(ordered.map((m) => m.user_id)));
    if (players.length < 4) {
      return NextResponse.json(
        { error: "Not enough unique joined players", unique: players.length },
        { status: 400 }
      );
    }

    // 7) Prevent double-start (if you have an "active" hand concept)
    // Example: don't allow another hand if last one isn't finished
    const { data: lastHand, error: lastHandErr } = await supabase
      .from("hands")
      .select("id, hand_number, dealer_user_id, status")
      .eq("session_id", session.id)
      .order("hand_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastHandErr) {
      return NextResponse.json(
        { error: "Hands read failed", details: lastHandErr.message },
        { status: 500 }
      );
    }

    // אם יש לך סטטוסים של hand שמייצגים "עדיין רצה" - תשימי פה guard
    // שימי לב: זה תלוי אצלך איך הגדרת status
    if (lastHand && lastHand.status && lastHand.status !== "finished") {
      // אם אצלך "waiting_deal" נחשב רץ, זה ימנע start כפול
      return NextResponse.json(
        { error: "Previous hand not finished", hand_id: lastHand.id, status: lastHand.status },
        { status: 409 }
      );
    }

    const nextHandNumber = (lastHand?.hand_number ?? 0) + 1;

    // 8) Dealer rotation
    // Hand #1: session.dealer_user_id
    // Next: dealer = next player after prev dealer (lastHand.dealer_user_id)
    const prevDealerId = lastHand?.dealer_user_id ?? session.dealer_user_id;

    let dealerIndex = players.indexOf(prevDealerId);
    if (dealerIndex === -1) {
      // prev dealer left table -> fallback to first in order
      dealerIndex = 0;
    } else {
      dealerIndex = nextIndex(dealerIndex, players.length);
    }

    const dealer_user_id = players[dealerIndex];
    const sb_user_id = players[nextIndex(dealerIndex, players.length)];
    const bb_user_id = players[nextIndex(nextIndex(dealerIndex, players.length), players.length)];

    // UTG preflop (for 4+ players): player after BB
    const turn_user_id = players[
      nextIndex(nextIndex(nextIndex(dealerIndex, players.length), players.length), players.length)
    ];

    // 9) Create hand
    const { data: hand, error: handErr } = await supabase
      .from("hands")
      .insert({
        table_id: tableId,
        session_id: session.id,
        hand_number: nextHandNumber,
        status: "waiting_deal",
        round: "preflop",
        dealer_user_id,
        sb_user_id,
        bb_user_id,
        turn_user_id,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (handErr) {
      return NextResponse.json(
        { error: "Hand insert failed", details: handErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        hand,
        order_used: useSeats ? "seat" : "joined_at",
        players_order: players,
        prev_dealer_id: prevDealerId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

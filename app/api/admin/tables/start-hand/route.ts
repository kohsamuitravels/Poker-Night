import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function nextIndex(i: number, n: number) {
  return (i + 1) % n;
}

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    // auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // role
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

    // body
    const body = await req.json().catch(() => null);
    const tableId: string | undefined = body?.tableId;

    if (!tableId) {
      return NextResponse.json({ error: "Missing tableId" }, { status: 400 });
    }

    // get running session
    const { data: session, error: sessionErr } = await supabase
      .from("table_sessions")
      .select("id, dealer_user_id, status")
      .eq("table_id", tableId)
      .eq("status", "running")
      .single();

    if (sessionErr || !session) {
      return NextResponse.json(
        { error: "No running session for this table" },
        { status: 400 }
      );
    }

    // members joined
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

    // order: seat if available, else joined_at
    const withSeat = members.filter((m) => m.seat !== null && m.seat !== undefined);
    const useSeats = withSeat.length >= 4;

    const ordered = [...members].sort((a, b) => {
      if (useSeats) return (a.seat ?? 999999) - (b.seat ?? 999999);
      const aTime = a.joined_at ? new Date(a.joined_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.joined_at ? new Date(b.joined_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    const players = Array.from(new Set(ordered.map((m) => m.user_id)));
    if (players.length < 4) {
      return NextResponse.json(
        { error: "Not enough unique joined players", unique: players.length },
        { status: 400 }
      );
    }

    // determine next hand number
    const { data: lastHand, error: lastHandErr } = await supabase
      .from("hands")
      .select("hand_number, dealer_user_id")
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

    const handNumber = (lastHand?.hand_number ?? 0) + 1;

    // dealer rotation:
    // hand #1 uses session.dealer_user_id
    // next hands: dealer = next player after previous dealer (clockwise)
    const prevDealerId = lastHand?.dealer_user_id ?? session.dealer_user_id;

    const prevDealerIndex = players.indexOf(prevDealerId);
    const dealerIndex =
      prevDealerIndex === -1 ? 0 : nextIndex(prevDealerIndex, players.length);

    const dealer_user_id = players[dealerIndex];
    const sb_user_id = players[nextIndex(dealerIndex, players.length)];
    const bb_user_id = players[nextIndex(nextIndex(dealerIndex, players.length), players.length)];
    const turn_user_id = players[nextIndex(nextIndex(nextIndex(dealerIndex, players.length), players.length), players.length)]; // UTG (preflop)

    // create hand
    const { data: hand, error: handErr } = await supabase
      .from("hands")
      .insert({
        table_id: tableId,
        session_id: session.id,
        hand_number: handNumber,
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
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

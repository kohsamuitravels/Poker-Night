import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomInt } from "crypto";

function pickRolesClockwise(userIdsInOrder: string[]) {
  const n = userIdsInOrder.length;

  // crypto-safe random
  const dealerIndex = randomInt(0, n);
  const sbIndex = (dealerIndex + 1) % n;
  const bbIndex = (dealerIndex + 2) % n;

  return {
    dealer_user_id: userIdsInOrder[dealerIndex],
    sb_user_id: userIdsInOrder[sbIndex],
    bb_user_id: userIdsInOrder[bbIndex],
  };
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

    // 2) Role check
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

    // 4) Check: already running? (NO maybeSingle - can handle multiple rows safely)
    const { data: runningSessions, error: runningErr } = await supabase
      .from("table_sessions")
      .select("id, started_at")
      .eq("table_id", tableId)
      .eq("status", "running")
      .order("started_at", { ascending: false });

    if (runningErr) {
      return NextResponse.json(
        { error: "Session check failed", details: runningErr.message },
        { status: 500 }
      );
    }

    if (runningSessions && runningSessions.length > 0) {
      return NextResponse.json(
        {
          error: "Game already running",
          session_id: runningSessions[0].id,
          running_count: runningSessions.length,
        },
        { status: 409 }
      );
    }

    // 5) Read members (joined only)
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

    // 6) Decide ordering: seat (if enough seats exist) else joined_at
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

    // 7) Unique user ids (safety)
    const userIdsInOrder = Array.from(new Set(ordered.map((m) => m.user_id)));

    if (userIdsInOrder.length < 4) {
      return NextResponse.json(
        { error: "Not enough unique joined players", unique: userIdsInOrder.length },
        { status: 400 }
      );
    }

    // 8) Pick dealer/sb/bb (random dealer once per game)
    const roles = pickRolesClockwise(userIdsInOrder);

    // 9) Create session
    const { data: session, error: sessionErr } = await supabase
      .from("table_sessions")
      .insert({
        table_id: tableId,
        status: "running",
        dealer_user_id: roles.dealer_user_id,
        sb_user_id: roles.sb_user_id,
        bb_user_id: roles.bb_user_id,
        started_by: user.id,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (sessionErr) {
      return NextResponse.json(
        { error: "Session insert failed", details: sessionErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        session,
        order_used: useSeats ? "seat" : "joined_at",
        players_order: userIdsInOrder,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

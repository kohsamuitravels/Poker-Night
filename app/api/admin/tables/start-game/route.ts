import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function pickRolesClockwise(userIdsInOrder: string[]) {
  const n = userIdsInOrder.length;
  const dealerIndex = Math.floor(Math.random() * n);
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
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: "Profile read failed", details: profileError.message },
        { status: 500 }
      );
    }

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Body
    const body = await req.json().catch(() => null);
    const tableId = body?.tableId;

    if (!tableId) {
      return NextResponse.json({ error: "Missing tableId" }, { status: 400 });
    }

    // 4) 가져오기 joined members
    const { data: members, error: membersErr } = await supabase
      .from("table_members")
      .select("user_id, seat, joined_at, status")
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

    // 5) לקבוע סדר "עם כיוון השעון"
    const withSeat = members.filter((m) => m.seat != null);
    const useSeats = withSeat.length >= 4;

    const ordered = [...members].sort((a: any, b: any) => {
      if (useSeats) {
        const sa = a.seat ?? 999;
        const sb = b.seat ?? 999;
        return sa - sb;
      }
      const ta = a.joined_at ? new Date(a.joined_at).getTime() : 0;
      const tb = b.joined_at ? new Date(b.joined_at).getTime() : 0;
      return ta - tb;
    });

    const userIdsInOrder = ordered.map((m: any) => m.user_id);

    // 6) לבחור Dealer רנדומלי + SB/BB לפי כיוון השעון
    const roles = pickRolesClockwise(userIdsInOrder);

    // 7) ליצור session חדש
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

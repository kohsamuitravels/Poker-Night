import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Fisher–Yates shuffle עם random אמיתי (עדיף מ-sort עם UUID)
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

    // 4) אל תאפשר להתחיל משחק אם כבר יש סשן "running" לטבלה
    const { data: existingRunning, error: existingErr } = await supabase
      .from("table_sessions")
      .select("id, status")
      .eq("table_id", tableId)
      .eq("status", "running")
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: "Session check failed", details: existingErr.message },
        { status: 500 }
      );
    }

    if (existingRunning) {
      return NextResponse.json(
        { error: "Game already running", session_id: existingRunning.id },
        { status: 409 }
      );
    }

    // 5) Read members
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

    // 6) סדר שחקנים: אם יש לפחות 4 עם seat מוגדר -> משתמשים ב-seat, אחרת joined_at
    const withSeat = members.filter((m) => m.seat !== null && m.seat !== undefined);
    const useSeats = withSeat.length >= 4;

    const ordered = [...members].sort((a, b) => {
      if (useSeats) {
        // seat null ילך לסוף
        const aSeat = a.seat ?? 999999;
        const bSeat = b.seat ?? 999999;
        return aSeat - bSeat;
      }

      // joined_at יכול להיות null -> ילך לסוף
      const aTime = a.joined_at ? new Date(a.joined_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.joined_at ? new Date(b.joined_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    // 7) unique user_ids (למקרה של כפילויות)
    const userIdsInOrder = Array.from(new Set(ordered.map((m) => m.user_id)));

    if (userIdsInOrder.length < 4) {
      return NextResponse.json(
        { error: "Not enough unique joined players", unique: userIdsInOrder.length },
        { status: 400 }
      );
    }

    // 8) אם תרצה שהבחירה תהיה "רנדומלית אבל הוגנת" לאורך זמן:
    // אפשר להגריל דילר ע"י shuffle ואז לקחת [0,1,2] בתור dealer/sb/bb על סדר הישיבה
    // כרגע: נגריל dealerIndex ואז SB/BB לפי כיוון השעון על הסדר הקיים
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
        players_order: userIdsInOrder, // עוזר לדיבוג
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

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const userId = body?.userId;

    if (!tableId || !userId) {
      return NextResponse.json(
        { error: "Missing tableId or userId" },
        { status: 400 }
      );
    }

    // 4) ליצור invite (אם כבר קיים pending - נחזיר אותו)
    // קודם נבדוק אם יש כבר invite פעיל
    const { data: existing } = await supabase
      .from("table_invites")
      .select("id,status")
      .eq("table_id", tableId)
      .eq("user_id", userId)
      .in("status", ["pending", "accepted"])
      .maybeSingle();

    if (existing?.status === "pending") {
      return NextResponse.json({ inviteId: existing.id, reused: true }, { status: 200 });
    }
    if (existing?.status === "accepted") {
      return NextResponse.json(
        { error: "User already accepted invite for this table" },
        { status: 409 }
      );
    }

    // 5) Insert invite
    const { data: invite, error: insertError } = await supabase
      .from("table_invites")
      .insert({
        table_id: tableId,
        user_id: userId,
        invited_by: user.id,
        status: "pending",
      })
      .select("id, table_id, user_id, status, created_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Insert failed", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ invite }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

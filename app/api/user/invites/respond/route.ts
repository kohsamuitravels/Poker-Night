import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    // Auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Body
    const body = await req.json().catch(() => null);
    const inviteId = body?.inviteId;
    const action = body?.action; // "accept" | "decline"

    if (!inviteId || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Missing inviteId or invalid action" },
        { status: 400 }
      );
    }

    // Fetch invite + ownership
    const { data: invite, error: inviteErr } = await supabase
      .from("table_invites")
      .select("id, table_id, user_id, status")
      .eq("id", inviteId)
      .single();

    if (inviteErr || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Invite is not pending", status: invite.status },
        { status: 409 }
      );
    }

    // Decline
    if (action === "decline") {
      const { error: updErr } = await supabase
        .from("table_invites")
        .update({ status: "declined" })
        .eq("id", inviteId);

      if (updErr) {
        return NextResponse.json(
          { error: "Update failed", details: updErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, action: "decline" }, { status: 200 });
    }

    // Accept: update invite
    const { error: accErr } = await supabase
      .from("table_invites")
      .update({ status: "accepted" })
      .eq("id", inviteId);

    if (accErr) {
      return NextResponse.json(
        { error: "Invite update failed", details: accErr.message },
        { status: 500 }
      );
    }

    // Accept: upsert member joined
    const { error: memberErr } = await supabase.from("table_members").upsert(
      {
        table_id: invite.table_id,
        user_id: user.id,
        status: "joined",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "table_id,user_id" }
    );

    if (memberErr) {
      return NextResponse.json(
        { error: "Member upsert failed", details: memberErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, action: "accept" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

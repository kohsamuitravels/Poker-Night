import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const handId: string | undefined = body?.handId;

    if (!handId) {
      return NextResponse.json({ error: "Missing handId" }, { status: 400 });
    }

    const { data: hand, error: handReadErr } = await supabase
      .from("hands")
      .select("id, status, dealer_user_id")
      .eq("id", handId)
      .single();

    if (handReadErr || !hand) {
      return NextResponse.json({ error: "Hand not found" }, { status: 404 });
    }

    if (hand.dealer_user_id !== user.id) {
      return NextResponse.json({ error: "Only dealer can confirm deal" }, { status: 403 });
    }

    if (hand.status !== "waiting_deal") {
      return NextResponse.json(
        { error: "Hand is not waiting_deal", status: hand.status },
        { status: 409 }
      );
    }

    const { data: updated, error: updErr } = await supabase
      .from("hands")
      .update({ status: "betting" })
      .eq("id", handId)
      .select("*")
      .single();

    if (updErr) {
      return NextResponse.json(
        { error: "Update failed", details: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, hand: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

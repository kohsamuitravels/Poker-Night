import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    // 1) מי המשתמש המחובר?
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) לוודא שהוא super_admin
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

    // 3) לקרוא body
    const body = await req.json().catch(() => null);
    const name = body?.name?.trim();

    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    // 4) ליצור שולחן
    const { data: table, error: insertError } = await supabase
      .from("poker_tables")
      .insert({
        name,
        created_by: user.id,
        status: "open",
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Insert failed", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ table }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

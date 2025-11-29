import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If authenticated, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  // If not authenticated, redirect to login
  redirect("/login");
}

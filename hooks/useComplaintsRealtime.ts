"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type UseComplaintsRealtimeOptions = {
  onChange: () => void;
  enabled?: boolean;
};

export function useComplaintsRealtime({
  onChange,
  enabled = true,
}: UseComplaintsRealtimeOptions) {
  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channel = supabase
      .channel("public:complaints:changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "complaints",
        },
        () => {
          onChange();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, onChange]);
}
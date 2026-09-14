"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type UseComplaintsRealtimeOptions = {
  onChange: () => void;
  enabled?: boolean;
};

export function useComplaintsRealtime({
  onChange,
  enabled = true,
}: UseComplaintsRealtimeOptions) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
          onChangeRef.current();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
}
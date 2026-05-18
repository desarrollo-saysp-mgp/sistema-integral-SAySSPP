"use client";

import Link from "next/link";
import { useState } from "react";
import { PageLoader } from "@/components/ui/page-loader";

type AlertLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function AlertLink({ href, children, className }: AlertLinkProps) {
  const [loading, setLoading] = useState(false);

  return (
    <>
      <PageLoader show={loading} />

      <Link
        href={href}
        className={className}
        onClick={() => setLoading(true)}
      >
        {children}
      </Link>
    </>
  );
}
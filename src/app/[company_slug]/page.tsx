"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function HomeRedirect() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.company_slug as string;

  useEffect(() => {
    if (slug) {
      router.replace(`/${slug}/templates`);
    }
  }, [slug, router]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
    </div>
  );
}

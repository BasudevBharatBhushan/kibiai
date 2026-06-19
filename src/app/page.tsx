import { redirect } from "next/navigation";
import { getSession } from "@/utils/auth";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login"); // This will be handled by middleware if it's a subdomain, or we can use a generic /login
  }

  // If we have a session, redirect to the appropriate workspace
  if (session.accountType === 'platform_admin') {
    redirect("/admin");
  }

  const companySlug = session.companyId || "kibiz-systems-inc"; // Fallback to legacy if no companyId
  redirect(`/${companySlug}/templates`);
}

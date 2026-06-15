import { CompanyProvider } from "@/components/providers/CompanyProvider";
import { Metadata } from "next";
import { HeaderProvider } from "@/context/HeaderContext";
import { AccessControlProvider } from "@/context/AccessControlContext";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Company Workspace | KiBiAI",
  description: "Manage your reports and charts.",
};

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CompanyProvider>
      <AccessControlProvider>
        <HeaderProvider>
          <AppShell>
            {children}
          </AppShell>
        </HeaderProvider>
      </AccessControlProvider>
    </CompanyProvider>
  );
}

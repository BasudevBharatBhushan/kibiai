import { ReportProvider } from "@/context/ReportContext";

export default function ReportBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ReportProvider>
      {children}
    </ReportProvider>
  );
}
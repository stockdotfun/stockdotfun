import type { ReactNode } from "react";
import PublicHeader from "@/components/layout/PublicHeader";
import Footer from "@/components/Footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

import { ScanSearch, Vault, KeyRound, Clock4 } from "lucide-react";
import MotionSection from "@/components/MotionSection";

const ITEMS = [
  {
    icon: ScanSearch,
    title: "Splits enforced by code",
    body: "Fee routes are contract logic, not promises.",
  },
  {
    icon: Vault,
    title: "Vaults you can audit",
    body: "Reward vaults are public addresses.",
  },
  {
    icon: KeyRound,
    title: "Non-custodial",
    body: "Your keys, your memes, your rewards.",
  },
  {
    icon: Clock4,
    title: "No closing bell",
    body: "Robinhood Chain markets run 24/7.",
  },
];

/** Slim trust strip — Robinhood-Protection energy, one screen-line tall. */
export default function Guarantee() {
  return (
    <section className="relative border-y border-border-soft bg-card py-14">
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <MotionSection>
          <p className="text-center font-serif text-2xl italic text-success sm:text-3xl">
            Don&apos;t trust the pairing — verify it onchain.
          </p>
        </MotionSection>
        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item, i) => (
            <MotionSection key={item.title} delay={i * 0.06}>
              <div className="group flex items-start gap-3.5">
                <item.icon
                  size={26}
                  strokeWidth={1.2}
                  className="mt-0.5 shrink-0 text-success/80 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110"
                />
                <div>
                  <h3 className="text-[14.5px] font-semibold tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            </MotionSection>
          ))}
        </div>
      </div>
    </section>
  );
}

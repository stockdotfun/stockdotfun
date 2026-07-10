import Image from "next/image";

type LogoProps = {
  compact?: boolean;
};

/**
 * StockDotFun brand mark — the official green market-uptick logo
 * (public/logo-mark.png), whose dot echoes the "Stock•Fun" wordmark dot.
 */
export default function Logo({ compact = false }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <Image
        src="/logo-mark.png"
        alt="StockDotFun"
        width={30}
        height={30}
        priority
        className="h-[30px] w-[30px] shrink-0"
      />
      {!compact && (
        <span className="font-semibold tracking-tight text-[17px] leading-none text-foreground">
          Stock
          <span className="mx-[3px] inline-block h-[6px] w-[6px] rounded-full bg-primary align-middle tick-dot" />
          Fun
        </span>
      )}
    </span>
  );
}

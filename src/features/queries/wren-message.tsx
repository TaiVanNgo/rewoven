import Image from "next/image";
import type { ReactNode } from "react";

export function WrenMessage({ children }: { children: ReactNode }) {
  return (
    <section className="query-wren-row" aria-label="Wren's reply">
      <div className="query-wren-avatar" aria-hidden="true">
        <Image
          src="/images/rewoven-logo.png"
          alt=""
          width={36}
          height={36}
          className="size-full object-contain"
        />
      </div>
      <div className="query-wren-message">{children}</div>
    </section>
  );
}

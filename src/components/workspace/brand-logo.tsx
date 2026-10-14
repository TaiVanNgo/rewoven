import Image from "next/image";

export function BrandLogo() {
  return (
    <Image
      src="/images/rewoven-logo.png"
      width={36}
      height={36}
      alt=""
      className="size-9 shrink-0 object-contain"
    />
  );
}

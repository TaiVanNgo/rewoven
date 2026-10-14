import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: "80px",
        background: "#171717",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>
        {site.name}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 24,
          fontSize: 32,
          lineHeight: 1.5,
          color: "#d4d4d4",
        }}
      >
        {site.description}
      </div>
    </div>,
    size,
  );
}

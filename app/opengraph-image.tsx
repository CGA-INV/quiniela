import { ImageResponse } from "next/og";

export const alt = "Quiniela Mundial 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a1f1c",
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(198,255,61,0.18) 0%, rgba(10,31,28,0) 55%)",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 10, color: "#8ba39c" }}>
          FIFA WORLD CUP
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 130,
            fontWeight: 900,
            color: "#c6ff3d",
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          MUNDIAL 2026
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#f5f1e8", marginTop: 24 }}>
          Predice · Compite · Gana
        </div>
      </div>
    ),
    { ...size },
  );
}

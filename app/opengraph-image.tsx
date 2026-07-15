import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          backgroundColor: "#18181b",
          padding: "80px",
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 700, color: "#b45309", display: "flex" }}>
          KushPrintCo OS
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 64,
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.15,
            display: "flex",
            maxWidth: 900,
          }}
        >
          Launch Your Clothing Brand. We Supply Everything.
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#a8a29e", display: "flex" }}>
          Powered by the DivinexAI ecosystem
        </div>
      </div>
    ),
    { ...size },
  );
}

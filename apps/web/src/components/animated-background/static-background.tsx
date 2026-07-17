"use client";

export function StaticBackground({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="absolute inset-0 bg-drift"
      style={{
        backgroundImage: isDark
          ? `radial-gradient(ellipse 130% 90% at 15% 10%, rgba(0,212,170,0.18), transparent 50%),
             radial-gradient(ellipse 100% 80% at 85% 90%, rgba(0,184,255,0.14), transparent 50%),
             radial-gradient(ellipse 80% 60% at 60% 30%, rgba(200,120,50,0.08), transparent 45%),
             radial-gradient(ellipse 160% 100% at 50% 50%, #080c18, #030409)`
          : `radial-gradient(ellipse 130% 90% at 15% 10%, rgba(40,100,220,0.12), transparent 50%),
             radial-gradient(ellipse 100% 80% at 85% 90%, rgba(30,80,200,0.10), transparent 50%),
             radial-gradient(ellipse 80% 60% at 60% 30%, rgba(60,100,180,0.08), transparent 45%),
             radial-gradient(ellipse 160% 100% at 50% 50%, #e8edf6, #dde3f0)`,
        backgroundSize: "120% 120%",
      }}
    />
  );
}

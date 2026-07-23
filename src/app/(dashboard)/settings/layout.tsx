import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Impostazioni</h1>
      <SettingsNav />
      {children}
    </div>
  );
}

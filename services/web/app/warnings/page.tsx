import { TopNavigation } from "@/components/top-navigation";
import { LiveWarnings } from "@/components/live-warnings";

export default function WarningsPage() {
  return <><TopNavigation /><main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8"><div className="mx-auto max-w-5xl"><LiveWarnings /></div></main></>;
}

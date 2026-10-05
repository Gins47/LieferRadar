import { OperationsDashboard } from "@/components/operations-dashboard";
import { TopNavigation } from "@/components/top-navigation";

export default function OperationsPage() {
  return <><TopNavigation /><main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8"><div className="mx-auto max-w-5xl"><header className="mb-8"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Operations</h1><p className="mt-2 text-sm leading-6 text-slate-600">Monitor shipments and disruptions requiring operator review.</p></header><OperationsDashboard /></div></main></>;
}

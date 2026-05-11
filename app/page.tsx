import { AGENTS } from "@/lib/agents";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-neon">Engenheiro.AI</p>
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white md:text-6xl">
          Orquestração de agentes IA para engenheiros PJ no Brasil.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
          MVP funcional com segurança de prompt, guardrails pós-LLM, persistência Supabase,
          métricas, feedback, rate limiting opcional e seis especialistas prontos para evoluir.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.values(AGENTS).map((agent) => (
          <article key={agent.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-xl font-semibold text-white">{agent.name}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{agent.mission}</p>
            <p className="mt-4 rounded-xl bg-slate-800 p-3 text-xs leading-5 text-slate-400">
              <span className="font-semibold text-neon">Saída:</span> {agent.expectedOutput}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

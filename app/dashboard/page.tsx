import DashboardClient from "./dashboard-client";

export const metadata = {
  title: "Dashboard | Engenheiro.AI",
  description: "Console operacional para testar agentes, perfil, conversas e anexos do Engenheiro.AI"
};

export default function DashboardPage() {
  return <DashboardClient />;
}

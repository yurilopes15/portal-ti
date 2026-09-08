import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTicketLookups } from "@/hooks/use-ticket-lookups";
import { useSlaConfigs, useSlaStatusRules } from "@/hooks/use-sla";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ColorBadge } from "@/components/ticket-badges";
import { toast } from "sonner";
import { Save } from "lucide-react";

export function SlaAdminPanel() {
  return (
    <div className="space-y-6">
      <SlaConfigsTable />
      <SlaStatusRulesTable />
    </div>
  );
}

type ConfigDraft = { resolution_hours: number; first_response_minutes: number; enabled: boolean };

function SlaConfigsTable() {
  const qc = useQueryClient();
  const { activePriorities } = useTicketLookups();
  const { data: configs = [] } = useSlaConfigs();
  const cfgByPriority = useMemo(() => new Map(configs.map((c) => [c.priority_id, c])), [configs]);
  const [drafts, setDrafts] = useState<Record<string, ConfigDraft>>({});

  function getDraft(priorityId: string): ConfigDraft {
    if (drafts[priorityId]) return drafts[priorityId];
    const c = cfgByPriority.get(priorityId);
    return {
      resolution_hours: c?.resolution_hours ?? 24,
      first_response_minutes: c?.first_response_minutes ?? 60,
      enabled: c?.enabled ?? true,
    };
  }

  function setDraft(priorityId: string, patch: Partial<ConfigDraft>) {
    setDrafts((d) => ({ ...d, [priorityId]: { ...getDraft(priorityId), ...patch } }));
  }

  async function save(priorityId: string) {
    const d = getDraft(priorityId);
    const payload = {
      priority_id: priorityId,
      resolution_hours: Number(d.resolution_hours),
      first_response_minutes: Math.round(Number(d.first_response_minutes)),
      enabled: d.enabled,
    };
    const { error } = await (supabase as any)
      .from("sla_configs")
      .upsert(payload, { onConflict: "priority_id" });
    if (error) return toast.error(error.message);
    toast.success("SLA salvo");
    setDrafts((d) => { const n = { ...d }; delete n[priorityId]; return n; });
    qc.invalidateQueries({ queryKey: ["sla_configs"] });
  }

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Tempos por prioridade</h2>
        <p className="text-xs text-muted-foreground">
          Defina o tempo total de resolução e o alvo de primeiro atendimento para cada prioridade.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="px-3 py-2 text-left">Prioridade</th>
              <th className="px-3 py-2 text-left">Resolução (horas)</th>
              <th className="px-3 py-2 text-left">1º atendimento (min)</th>
              <th className="px-3 py-2 text-left">Ativo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {activePriorities.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhuma prioridade ativa.</td></tr>
            ) : activePriorities.map((p) => {
              const d = getDraft(p.id);
              const dirty = !!drafts[p.id];
              return (
                <tr key={p.id} className="hover:bg-accent/40">
                  <td className="px-3 py-2"><ColorBadge name={p.nome} color={p.cor} /></td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} step={0.5} className="w-28"
                      value={d.resolution_hours}
                      onChange={(e) => setDraft(p.id, { resolution_hours: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} step={5} className="w-28"
                      value={d.first_response_minutes}
                      onChange={(e) => setDraft(p.id, { first_response_minutes: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <Switch checked={d.enabled} onCheckedChange={(v) => setDraft(p.id, { enabled: v })} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant={dirty ? "default" : "outline"} onClick={() => save(p.id)}>
                      <Save className="h-3 w-3 mr-1" />Salvar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SlaStatusRulesTable() {
  const qc = useQueryClient();
  const { activeStatuses } = useTicketLookups();
  const { data: rules = [] } = useSlaStatusRules();
  const byStatus = useMemo(() => new Map(rules.map((r) => [r.status_id, r])), [rules]);

  async function upsert(statusId: string, patch: { pause_sla?: boolean; finish_sla?: boolean }) {
    const cur = byStatus.get(statusId);
    const next = {
      status_id: statusId,
      pause_sla: patch.pause_sla ?? cur?.pause_sla ?? false,
      finish_sla: patch.finish_sla ?? cur?.finish_sla ?? false,
    };
    // mutuamente exclusivos
    if (patch.pause_sla) next.finish_sla = false;
    if (patch.finish_sla) next.pause_sla = false;
    const { error } = await (supabase as any)
      .from("sla_status_rules")
      .upsert(next, { onConflict: "status_id" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["sla_status_rules"] });
  }

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Comportamento dos status</h2>
        <p className="text-xs text-muted-foreground">
          "Pausa SLA" pausa o contador (ex.: aguardando usuário). "Finaliza SLA" encerra a contagem (ex.: resolvido). As duas opções são mutuamente exclusivas.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Pausa SLA</th>
              <th className="px-3 py-2 text-left">Finaliza SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {activeStatuses.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">Nenhum status ativo.</td></tr>
            ) : activeStatuses.map((s) => {
              const r = byStatus.get(s.id);
              return (
                <tr key={s.id} className="hover:bg-accent/40">
                  <td className="px-3 py-2"><ColorBadge name={s.nome} color={s.cor} /></td>
                  <td className="px-3 py-2">
                    <Switch checked={!!r?.pause_sla} onCheckedChange={(v) => upsert(s.id, { pause_sla: v })} />
                  </td>
                  <td className="px-3 py-2">
                    <Switch checked={!!r?.finish_sla} onCheckedChange={(v) => upsert(s.id, { finish_sla: v })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

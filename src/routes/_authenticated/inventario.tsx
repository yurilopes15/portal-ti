import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Eye, ShieldAlert, Printer } from "lucide-react";
import { PrinterTonerManager } from "@/components/printer-toner-manager";

import { usePermissions } from "@/hooks/use-permissions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useServerFn } from "@tanstack/react-start";
import { softDeleteEntity } from "@/lib/admin-actions.functions";
import { INVENTORY_GROUPS, type InventoryGroupKey } from "@/lib/inventory-groups";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventario")({
  validateSearch: (s: Record<string, unknown>) => ({
    grupo: typeof s.grupo === "string" && s.grupo in INVENTORY_GROUPS
      ? (s.grupo as InventoryGroupKey)
      : undefined,
  }),
  component: InventarioPage,
});

type Item = {
  id: string; patrimonio: string; tipo: string; fabricante: string | null; modelo: string | null;
  numero_serie: string | null; localizacao: string | null; status: string; responsavel_id: string | null;
  observacoes: string | null; category_id: string | null;
  anydesk_id: string | null; teamviewer_id: string | null; computer_name: string | null;
  operating_system: string | null; ip_address: string | null; mac_address: string | null;
  type_id: string | null; status_id: string | null; manufacturer_id: string | null; operating_system_id: string | null;
  license_url: string | null; license_username: string | null; license_password: string | null;
  license_expires_at: string | null; license_quantity: number | null; license_alert_days: number[] | null;
  bitlocker_id: string | null; bitlocker_recovery_key: string | null;
};


type Category = { id: string; nome: string; descricao: string | null; ativo: boolean };
type Lookup = { id: string; nome: string; ativo: boolean };

const UNASSIGNED = "__unassigned__";
const ALL = "__all__";

function InventarioPage() {
  const { isTI, isLoading } = usePermissions();
  const { grupo } = Route.useSearch();
  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isTI) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <h2 className="font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas a equipe de TI pode acessar o inventário.</p>
      </Card>
    );
  }
  return <ItemsTab grupo={grupo} />;
}

function ItemsTab({ grupo }: { grupo?: InventoryGroupKey }) {
  const { isTI, canManageInventory, canDeleteInventory } = usePermissions();
  const softDelete = useServerFn(softDeleteEntity);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [tonerMgr, setTonerMgr] = useState<{ id: string; label: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [fCat, setFCat] = useState(ALL);
  const [fResp, setFResp] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fLoc, setFLoc] = useState(ALL);

  const { data: items = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*, responsavel:profiles!inventory_items_responsavel_id_fkey(nome, departamento), categoria:inventory_categories(id, nome)")
        .is("deleted_at", null)
        .order("patrimonio");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, departamento").order("nome");
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_categories").select("*").order("nome");
      return (data ?? []) as Category[];
    },
  });

  function useLookup(table: string) {
    return useQuery({
      queryKey: [table],
      queryFn: async () => {
        const { data, error } = await (supabase as any).from(table).select("*").order("nome");
        if (error) throw error;
        return (data ?? []) as Lookup[];
      },
    });
  }
  const { data: statuses = [] } = useLookup("inventory_statuses");
  const { data: manufacturers = [] } = useLookup("inventory_manufacturers");
  const { data: oses = [] } = useLookup("inventory_operating_systems");

  const activeCats = categories.filter((c) => c.ativo);
  const activeStatuses = statuses.filter((s) => s.ativo);
  const activeManufacturers = manufacturers.filter((m) => m.ativo);
  const activeOses = oses.filter((o) => o.ativo);

  // Filtro automático por grupo operacional (vindo da sidebar via ?grupo=).
  const groupDef = grupo ? INVENTORY_GROUPS[grupo] : null;
  const groupCatIds = useMemo(() => {
    if (!groupDef) return null;
    const wanted = groupDef.categorias.map((n) => n.toLowerCase());
    return new Set(activeCats.filter((c) => wanted.includes(c.nome.toLowerCase())).map((c) => c.id));
  }, [groupDef, activeCats]);

  // Reseta o filtro manual de categoria ao trocar de grupo na sidebar.
  useEffect(() => {
    setFCat(ALL);
  }, [grupo]);

  const localizacoes = useMemo(
    () => Array.from(new Set(items.map((i: any) => i.localizacao || i.responsavel?.departamento).filter(Boolean))).sort(),
    [items],
  );

  const filtered = items.filter((i: any) => {
    if (q && !`${i.patrimonio} ${i.categoria?.nome ?? ""} ${i.modelo ?? ""} ${i.computer_name ?? ""} ${i.numero_serie ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (groupCatIds && (!i.category_id || !groupCatIds.has(i.category_id))) return false;
    if (fCat !== ALL && i.category_id !== fCat) return false;
    if (fResp !== ALL && i.responsavel_id !== fResp) return false;
    if (fStatus !== ALL && i.status_id !== fStatus) return false;
    const loc = i.localizacao || i.responsavel?.departamento;
    if (fLoc !== ALL && loc !== fLoc) return false;
    return true;
  });

  function onResponsavelChange(value: string) {
    if (value === UNASSIGNED) {
      setEditing({ ...editing, responsavel_id: null });
      return;
    }
    const p = profiles.find((x: any) => x.id === value);
    setEditing({
      ...editing,
      responsavel_id: value,
      localizacao: p?.departamento || editing?.localizacao || null,
    });
  }

  async function save() {
    if (!editing?.patrimonio || !editing?.category_id) return toast.error("Patrimônio e categoria são obrigatórios");
    const respProfile = editing.responsavel_id ? profiles.find((p: any) => p.id === editing.responsavel_id) : null;
    const localizacao = editing.localizacao?.trim() || respProfile?.departamento || null;
    const categoryName = activeCats.find((c) => c.id === editing.category_id)?.nome ?? "";
    const statusName = activeStatuses.find((s) => s.id === editing.status_id)?.nome ?? "Ativo";
    const manufName = editing.manufacturer_id ? manufacturers.find((m) => m.id === editing.manufacturer_id)?.nome ?? null : null;
    const osName = editing.operating_system_id ? oses.find((o) => o.id === editing.operating_system_id)?.nome ?? null : null;
    const payload: any = {
      patrimonio: editing.patrimonio,
      tipo: categoryName,
      type_id: null,
      status: statusName, status_id: editing.status_id,
      fabricante: manufName, manufacturer_id: editing.manufacturer_id || null,
      operating_system: osName, operating_system_id: editing.operating_system_id || null,
      modelo: editing.modelo || null,
      numero_serie: editing.numero_serie || null, localizacao,
      observacoes: editing.observacoes || null,
      responsavel_id: editing.responsavel_id || null,
      category_id: editing.category_id || null,
      anydesk_id: editing.anydesk_id || null,
      teamviewer_id: editing.teamviewer_id || null,
      computer_name: editing.computer_name || null,
      ip_address: editing.ip_address || null,
      mac_address: editing.mac_address || null,
      license_url: editing.license_url || null,
      license_username: editing.license_username || null,
      license_password: editing.license_password || null,
      license_expires_at: editing.license_expires_at || null,
      license_quantity: editing.license_quantity ?? null,
      license_alert_days: editing.license_alert_days && editing.license_alert_days.length ? editing.license_alert_days : [30, 7],
      bitlocker_id: editing.bitlocker_id || null,
      bitlocker_recovery_key: editing.bitlocker_recovery_key || null,
    };

    const op = editing.id
      ? supabase.from("inventory_items").update(payload).eq("id", editing.id)
      : supabase.from("inventory_items").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Salvo!");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }

  async function removeItem(id: string, patrimonio: string) {
    try {
      await softDelete({ data: { entity_type: "inventory_item", entity_id: id, metadata: { patrimonio } } });
      toast.success("Equipamento excluído (auditado)");
      qc.invalidateQueries({ queryKey: ["inventory"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {groupDef ? `${groupDef.icon} ${groupDef.label}` : "Inventário"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {groupDef
              ? `Equipamentos da categoria ${groupDef.label}`
              : "Equipamentos cadastrados"}
          </p>
        </div>
        {isTI && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ status_id: activeStatuses.find((s) => s.nome.toLowerCase() === "ativo")?.id })}><Plus className="h-4 w-4 mr-1" />Novo Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} Equipamento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Section title="Identificação">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Patrimônio *"><Input value={editing?.patrimonio ?? ""} onChange={(e) => setEditing({ ...editing, patrimonio: e.target.value })} /></Field>
                    <Field label="Categoria *">
                      <Select value={editing?.category_id ?? ""} onValueChange={(v) => setEditing({ ...editing, category_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {activeCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Status">
                      <Select value={editing?.status_id ?? ""} onValueChange={(v) => setEditing({ ...editing, status_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{activeStatuses.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Fabricante">
                      <Select value={editing?.manufacturer_id ?? UNASSIGNED} onValueChange={(v) => setEditing({ ...editing, manufacturer_id: v === UNASSIGNED ? null : v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>— Não informado —</SelectItem>
                          {activeManufacturers.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Modelo"><Input value={editing?.modelo ?? ""} onChange={(e) => setEditing({ ...editing, modelo: e.target.value })} /></Field>
                    <Field label="N° Série"><Input value={editing?.numero_serie ?? ""} onChange={(e) => setEditing({ ...editing, numero_serie: e.target.value })} /></Field>
                    {(() => {
                      const catName = activeCats.find((c) => c.id === editing?.category_id)?.nome.toLowerCase() ?? "";
                      const isComputer = INVENTORY_GROUPS.computadores.categorias.some((n) => n.toLowerCase() === catName);
                      if (!isComputer) return null;
                      return (
                        <>
                          <Field label="Nome do Computador"><Input value={editing?.computer_name ?? ""} onChange={(e) => setEditing({ ...editing, computer_name: e.target.value })} placeholder="DESKTOP-XXX" /></Field>
                          <Field label="Sistema Operacional">
                            <Select value={editing?.operating_system_id ?? UNASSIGNED} onValueChange={(v) => setEditing({ ...editing, operating_system_id: v === UNASSIGNED ? null : v })}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNASSIGNED}>— Não informado —</SelectItem>
                                {activeOses.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </Field>
                        </>
                      );
                    })()}
                    <Field label="Endereço IP"><Input value={editing?.ip_address ?? ""} onChange={(e) => setEditing({ ...editing, ip_address: e.target.value })} placeholder="192.168.1.10" /></Field>
                    <Field label="Endereço MAC"><Input value={editing?.mac_address ?? ""} onChange={(e) => setEditing({ ...editing, mac_address: e.target.value })} placeholder="00:1A:2B:..." /></Field>
                  </div>
                </Section>

                {(() => {
                  const catName = activeCats.find((c) => c.id === editing?.category_id)?.nome.toLowerCase() ?? "";
                  const isComputer = INVENTORY_GROUPS.computadores.categorias.some((n) => n.toLowerCase() === catName);
                  if (!isComputer) return null;
                  return (
                    <>
                      <Section title="Acesso Remoto">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="AnyDesk ID"><Input value={editing?.anydesk_id ?? ""} onChange={(e) => setEditing({ ...editing, anydesk_id: e.target.value })} /></Field>
                          <Field label="TeamViewer ID"><Input value={editing?.teamviewer_id ?? ""} onChange={(e) => setEditing({ ...editing, teamviewer_id: e.target.value })} /></Field>
                        </div>
                      </Section>
                      <Section title="BitLocker">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Identificador BitLocker"><Input value={editing?.bitlocker_id ?? ""} onChange={(e) => setEditing({ ...editing, bitlocker_id: e.target.value })} placeholder="Ex.: ABCD1234-..." /></Field>
                          <Field label="Chave de Recuperação"><Input value={editing?.bitlocker_recovery_key ?? ""} onChange={(e) => setEditing({ ...editing, bitlocker_recovery_key: e.target.value })} placeholder="000000-000000-..." /></Field>
                        </div>
                      </Section>
                    </>
                  );
                })()}

                {(() => {
                  const catName = activeCats.find((c) => c.id === editing?.category_id)?.nome.toLowerCase() ?? "";
                  const isLicense = INVENTORY_GROUPS.licencas.categorias.some((n) => n.toLowerCase() === catName);
                  if (!isLicense) return null;
                  const alertDays = editing?.license_alert_days ?? [30, 7];
                  const alertStr = alertDays.join(", ");
                  return (
                    <Section title="Licença">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Link"><Input value={editing?.license_url ?? ""} onChange={(e) => setEditing({ ...editing, license_url: e.target.value })} placeholder="https://..." /></Field>
                        <Field label="Usuário"><Input value={editing?.license_username ?? ""} onChange={(e) => setEditing({ ...editing, license_username: e.target.value })} /></Field>
                        <Field label="Senha"><Input type="text" value={editing?.license_password ?? ""} onChange={(e) => setEditing({ ...editing, license_password: e.target.value })} /></Field>
                        <Field label="Validade"><Input type="date" value={editing?.license_expires_at ?? ""} onChange={(e) => setEditing({ ...editing, license_expires_at: e.target.value })} /></Field>
                        <Field label="Quantidade"><Input type="number" min={0} value={editing?.license_quantity ?? ""} onChange={(e) => setEditing({ ...editing, license_quantity: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                        <Field label="Avisar antes (dias, separados por vírgula)">
                          <Input
                            value={alertStr}
                            onChange={(e) => {
                              const arr = e.target.value.split(/[,;\s]+/).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n) && n > 0);
                              setEditing({ ...editing, license_alert_days: arr });
                            }}
                            placeholder="30, 7"
                          />
                        </Field>
                      </div>
                    </Section>
                  );
                })()}

                <Section title="Atribuição">

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Responsável">
                      <Select value={editing?.responsavel_id ?? UNASSIGNED} onValueChange={onResponsavelChange}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>— Sem responsável —</SelectItem>
                          {profiles.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}{p.departamento ? ` (${p.departamento})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Localização">
                      <Input value={editing?.localizacao ?? ""} onChange={(e) => setEditing({ ...editing, localizacao: e.target.value })} placeholder="Preenchida pelo departamento" />
                    </Field>
                  </div>
                  <Field label="Observações"><Textarea value={editing?.observacoes ?? ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} rows={2} /></Field>
                </Section>
              </div>
              <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-3 space-y-3">
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar patrimônio, tipo, modelo, computador..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <FilterSelect
            label="Categoria"
            value={fCat}
            onChange={setFCat}
            options={[
              { v: ALL, l: "Todas" },
              ...activeCats
                .filter((c) => !groupCatIds || groupCatIds.has(c.id))
                .map((c) => ({ v: c.id, l: c.nome })),
            ]}
          />
          <FilterSelect label="Responsável" value={fResp} onChange={setFResp} options={[{ v: ALL, l: "Todos" }, ...profiles.map((p: any) => ({ v: p.id, l: p.nome }))]} />
          <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={[{ v: ALL, l: "Todos" }, ...activeStatuses.map((s) => ({ v: s.id, l: s.nome }))]} />
          <FilterSelect label="Localização" value={fLoc} onChange={setFLoc} options={[{ v: ALL, l: "Todas" }, ...localizacoes.map((l) => ({ v: l as string, l: l as string }))]} />
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          {(() => {
            const showComputerCol = !grupo || grupo === "computadores";
            const isPrintersView = grupo === "impressoras";
            const colCount = (showComputerCol ? 7 : 6);
            return (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 text-left">{isPrintersView ? "Modelo" : "Patrimônio"}</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                {showComputerCol && <th className="px-4 py-3 text-left">Computador / SO</th>}
                <th className="px-4 py-3 text-left">Localização</th>
                <th className="px-4 py-3 text-left">Responsável</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-muted-foreground">Nenhum item.</td></tr>
              ) : filtered.map((i: any) => (
                <tr key={i.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2 font-mono text-xs">{isPrintersView ? ([i.fabricante, i.modelo].filter(Boolean).join(" ") || "—") : i.patrimonio}</td>

                  <td className="px-4 py-2">{i.categoria?.nome ?? i.tipo}</td>
                  {showComputerCol && (
                    <td className="px-4 py-2 text-muted-foreground">
                      <div>{i.computer_name ?? "—"}</div>
                      <div className="text-xs">{i.operating_system ?? ""}</div>
                    </td>
                  )}
                  <td className="px-4 py-2 text-muted-foreground">{i.localizacao ?? i.responsavel?.departamento ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{i.responsavel?.nome ?? "—"}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{i.status}</Badge></td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => setViewing(i)}><Eye className="h-3 w-3" /></Button>
                      {isTI && (() => {
                        const catName = (i.categoria?.nome ?? i.tipo ?? "").toLowerCase();
                        const isPrinter = INVENTORY_GROUPS.impressoras.categorias.some((n) => n.toLowerCase() === catName);
                        if (!isPrinter) return null;
                        return (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Gerenciar toners"
                            onClick={() => setTonerMgr({ id: i.id, label: `${i.patrimonio} · ${[i.fabricante, i.modelo].filter(Boolean).join(" ") || "Impressora"}` })}
                          >
                            <Printer className="h-3 w-3" />
                          </Button>
                        );
                      })()}
                      {canManageInventory && (
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                      )}
                      {canDeleteInventory && (
                        <ConfirmDeleteDialog
                          entityLabel={`o equipamento ${i.patrimonio}`}
                          onConfirm={() => removeItem(i.id, i.patrimonio)}
                          trigger={<Button size="icon" variant="ghost"><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            );
          })()}
        </div>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Equipamento {viewing?.patrimonio}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <ViewSection title="Identificação">
                <ViewRow label="Patrimônio" value={viewing.patrimonio} />
                <ViewRow label="Categoria" value={viewing.categoria?.nome ?? viewing.tipo} />
                <ViewRow label="Fabricante / Modelo" value={[viewing.fabricante, viewing.modelo].filter(Boolean).join(" ") || "—"} />
                <ViewRow label="N° Série" value={viewing.numero_serie ?? "—"} />
                <ViewRow label="Nome do Computador" value={viewing.computer_name ?? "—"} />
                <ViewRow label="Sistema Operacional" value={viewing.operating_system ?? "—"} />
                <ViewRow label="IP" value={viewing.ip_address ?? "—"} />
                <ViewRow label="MAC" value={viewing.mac_address ?? "—"} />
              </ViewSection>
              <ViewSection title="Acesso Remoto">
                <ViewRow label="AnyDesk" value={viewing.anydesk_id ?? "—"} />
                <ViewRow label="TeamViewer" value={viewing.teamviewer_id ?? "—"} />
              </ViewSection>
              {(viewing.bitlocker_id || viewing.bitlocker_recovery_key) && (
                <ViewSection title="BitLocker">
                  <ViewRow label="Identificador BitLocker" value={viewing.bitlocker_id ?? "—"} />
                  <ViewRow label="Chave de Recuperação" value={viewing.bitlocker_recovery_key ?? "—"} />
                </ViewSection>
              )}
              <ViewSection title="Atribuição">
                <ViewRow label="Responsável" value={viewing.responsavel?.nome ?? "—"} />
                <ViewRow label="Localização" value={viewing.localizacao ?? viewing.responsavel?.departamento ?? "—"} />
                <ViewRow label="Status" value={viewing.status} />
                {viewing.observacoes && <ViewRow label="Observações" value={viewing.observacoes} />}
              </ViewSection>
              {(viewing.license_url || viewing.license_username || viewing.license_expires_at || viewing.license_quantity != null) && (
                <ViewSection title="Licença">
                  <ViewRow label="Link" value={viewing.license_url ?? "—"} />
                  <ViewRow label="Usuário" value={viewing.license_username ?? "—"} />
                  <ViewRow label="Senha" value={viewing.license_password ?? "—"} />
                  <ViewRow label="Validade" value={viewing.license_expires_at ? new Date(viewing.license_expires_at + "T00:00:00").toLocaleDateString("pt-BR") : "—"} />
                  <ViewRow label="Quantidade" value={viewing.license_quantity != null ? String(viewing.license_quantity) : "—"} />
                  <ViewRow label="Avisar antes (dias)" value={(viewing.license_alert_days ?? []).join(", ") || "—"} />
                </ViewSection>
              )}
            </div>

          )}
        </DialogContent>
      </Dialog>

      {tonerMgr && (
        <PrinterTonerManager
          printerId={tonerMgr.id}
          printerLabel={tonerMgr.label}
          open={!!tonerMgr}
          onOpenChange={(o) => !o && setTonerMgr(null)}
        />
      )}
    </div>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function ViewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2 rounded-md border p-3">{children}</div>
    </div>
  );
}

function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

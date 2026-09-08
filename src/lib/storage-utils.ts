/**
 * Sanitiza o nome do arquivo para uso como chave no Supabase Storage.
 * Remove acentos, espaços e caracteres especiais não permitidos.
 */
export function sanitizeStorageFilename(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : "";

  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-zA-Z0-9._-]+/g, "-") // troca inválidos por hífen
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "");

  const safeBase = clean(base) || "arquivo";
  const safeExt = ext ? "." + clean(ext.slice(1)).toLowerCase() : "";
  return (safeBase + safeExt).slice(0, 120);
}

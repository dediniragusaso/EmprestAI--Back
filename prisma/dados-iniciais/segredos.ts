// Remove valores de segredo de qualquer texto antes de imprimir (rules/secrets.md).
export function redigir(texto: string, segredos: Array<string | undefined>): string {
  let saida = texto;
  for (const segredo of segredos) {
    if (segredo && segredo.length >= 3) saida = saida.split(segredo).join('***');
  }
  return saida;
}

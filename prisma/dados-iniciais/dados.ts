// Spec 002-dados-iniciais, R1 e R3: le e valida equipamentos.json e creditos.json.
// Sem rede e sem banco: so arquivo e Zod. Erro derruba o script antes de qualquer escrita.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { EquipmentCategory, EquipmentStatus } from '@prisma/client';

const PASTA_IMAGENS = path.resolve(__dirname, '..', '..', 'scripts', 'imagens-equipamentos');

// Tabelas fechadas (R1): valor desconhecido derruba o script.
const CATEGORIAS: Record<string, EquipmentCategory> = {
  notebook: 'NOTEBOOK',
  monitor: 'MONITOR',
  cabo: 'CABO',
  camera: 'CAMERA',
};
const SITUACOES: Record<string, EquipmentStatus> = {
  disponivel: 'DISPONIVEL',
  manutencao: 'MANUTENCAO',
};

// `busca` e `buscaOriginal` sao da skill de imagem: o Zod as descarta.
const equipamentoSchema = z.object({
  patrimonio: z.string().regex(/^TI-\d{4}$/, 'patrimonio fora do formato TI-####'),
  nome: z.string().min(1),
  categoria: z.enum(Object.keys(CATEGORIAS) as [string, ...string[]]),
  situacao: z.enum(Object.keys(SITUACOES) as [string, ...string[]]),
});

const creditoSchema = z.object({
  patrimonio: z.string().regex(/^TI-\d{4}$/),
  pixabayId: z.number().int().positive(),
  autor: z.string().min(1),
  pageURL: z.string().url(),
  licenca: z.string().min(1),
});

export interface ItemEquipamento {
  patrimonio: string;
  nome: string;
  categoria: EquipmentCategory;
  status: EquipmentStatus;
  imagePixabayId: number;
  imageAuthor: string;
  imagePageUrl: string;
  imageLicense: string;
}

function duplicados(valores: Array<string | number>): Array<string | number> {
  return valores.filter((v, i) => valores.indexOf(v) !== i);
}

/** Valida e junta equipamentos e creditos. Funcao pura: recebe o que foi lido dos JSON. */
export function montarItens(equipamentosBrutos: unknown, creditosBrutos: unknown): ItemEquipamento[] {
  const equipamentos = z.array(equipamentoSchema).min(1).parse(equipamentosBrutos);
  const creditos = z.array(creditoSchema).parse(creditosBrutos);

  const repetidosPatrimonio = duplicados(equipamentos.map((e) => e.patrimonio));
  if (repetidosPatrimonio.length) {
    throw new Error(`equipamentos.json: patrimonio repetido (${repetidosPatrimonio.join(', ')})`);
  }
  const repetidosFoto = duplicados(creditos.map((c) => c.pixabayId));
  if (repetidosFoto.length) {
    throw new Error(`creditos.json: foto repetida (pixabayId ${repetidosFoto.join(', ')})`);
  }

  const porPatrimonio = new Map(creditos.map((c) => [c.patrimonio, c]));
  return equipamentos.map((e) => {
    const credito = porPatrimonio.get(e.patrimonio);
    if (!credito) throw new Error(`creditos.json: sem credito para ${e.patrimonio}`);
    return {
      patrimonio: e.patrimonio,
      nome: e.nome,
      categoria: CATEGORIAS[e.categoria],
      status: SITUACOES[e.situacao],
      imagePixabayId: credito.pixabayId,
      imageAuthor: credito.autor,
      imagePageUrl: credito.pageURL,
      imageLicense: credito.licenca,
    };
  });
}

/** Le os dois arquivos versionados de back/scripts/imagens-equipamentos/. */
export function lerItens(pasta: string = PASTA_IMAGENS): ItemEquipamento[] {
  const ler = (nome: string): unknown => JSON.parse(readFileSync(path.join(pasta, nome), 'utf8'));
  return montarItens(ler('equipamentos.json'), ler('creditos.json'));
}

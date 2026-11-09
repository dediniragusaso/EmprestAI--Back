// Utilitarios compartilhados dos scripts de imagens (ADR-004).
// So recursos nativos do Node e o sharp. Nunca imprima chave: use redigir().
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

export const LARGURA = 800;
export const ALTURA = 600;
export const LICENCA = 'Pixabay Content License';

export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const BACK_DIR = path.resolve(SCRIPT_DIR, '..', '..');
// Area de preparo: ignorada pelo git (back/.gitignore).
export const PREPARO_DIR = path.join(BACK_DIR, '.preparo-imagens');
export const FINAL_DIR = path.join(PREPARO_DIR, 'final');
export const CACHE_DIR = path.join(PREPARO_DIR, 'cache');
export const MANIFESTO_PATH = path.join(PREPARO_DIR, 'manifesto.json');
// Versionados: a lista e a decisao humana.
export const EQUIPAMENTOS_PATH = path.join(SCRIPT_DIR, 'equipamentos.json');
export const REVISAO_PATH = path.join(SCRIPT_DIR, 'revisao.json');

export async function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(await readFile(arquivo, 'utf8'));
  } catch (erro) {
    if (erro.code === 'ENOENT' && padrao !== undefined) return padrao;
    throw new Error(`Nao consegui ler ${path.basename(arquivo)}: ${erro.message}`);
  }
}

export async function existe(arquivo) {
  try {
    await access(arquivo);
    return true;
  } catch {
    return false;
  }
}

// Remove valores de segredo de qualquer texto antes de imprimir.
export function redigir(texto) {
  let saida = String(texto);
  for (const nome of ['PIXABAY_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const valor = process.env[nome];
    if (valor && valor.length >= 8) saida = saida.split(valor).join('***');
  }
  return saida;
}

export function falhar(mensagem) {
  console.error(redigir(mensagem));
  process.exit(1);
}

// revisao.json: { "<id pixabay>": { "status": "aprovada"|"reprovada", "motivo": "..." } }
export async function lerRevisao() {
  return lerJson(REVISAO_PATH, {});
}

export function idsReprovados(revisao) {
  return new Set(
    Object.entries(revisao)
      .filter(([, r]) => r && r.status === 'reprovada')
      .map(([id]) => String(id)),
  );
}

export async function dimensoes(arquivo) {
  const meta = await sharp(arquivo).metadata();
  return { width: meta.width, height: meta.height, format: meta.format };
}

// Confere o estado completo: lista, manifesto, arquivos finais e revisao.
// Devolve { itens, erros, pendentes }. Nao imprime nem encerra o processo.
export async function validarTudo({ exigirRevisao }) {
  const equipamentos = await lerJson(EQUIPAMENTOS_PATH);
  const manifesto = await lerJson(MANIFESTO_PATH, { itens: [] });
  const revisao = await lerRevisao();
  const erros = [];
  const pendentes = [];
  const itens = [];

  for (const [id, r] of Object.entries(revisao)) {
    if (!r || !['aprovada', 'reprovada'].includes(r.status)) {
      erros.push(`revisao.json: id ${id} com status invalido (use "aprovada" ou "reprovada")`);
    } else if (r.status === 'reprovada' && !String(r.motivo ?? '').trim()) {
      erros.push(`revisao.json: id ${id} reprovada sem motivo`);
    }
  }

  const porPatrimonio = new Map((manifesto.itens ?? []).map((i) => [i.patrimonio, i]));
  const idsVistos = new Map();

  for (const equip of equipamentos) {
    const item = porPatrimonio.get(equip.patrimonio);
    if (!item) {
      erros.push(`${equip.patrimonio}: sem entrada no manifesto (rode preparar)`);
      continue;
    }
    const px = item.pixabay ?? {};
    const campos = { id: px.id, pageURL: px.pageURL, user: px.user, user_id: px.user_id, licenca: item.licenca };
    for (const [campo, valor] of Object.entries(campos)) {
      if (valor === undefined || valor === null || String(valor).trim() === '') {
        erros.push(`${equip.patrimonio}: manifesto sem ${campo}`);
      }
    }
    if (px.pageURL) {
      try {
        const host = new URL(px.pageURL).hostname;
        if (host !== 'pixabay.com' && !host.endsWith('.pixabay.com')) {
          erros.push(`${equip.patrimonio}: pageURL fora do Pixabay`);
        }
      } catch {
        erros.push(`${equip.patrimonio}: pageURL invalida`);
      }
    }

    const id = String(px.id);
    if (idsVistos.has(id)) {
      erros.push(`${equip.patrimonio}: foto repetida (id ${id} ja usada em ${idsVistos.get(id)})`);
    }
    idsVistos.set(id, equip.patrimonio);

    const arquivo = path.join(FINAL_DIR, `${equip.patrimonio}.jpg`);
    let dim = null;
    if (!(await existe(arquivo))) {
      erros.push(`${equip.patrimonio}: arquivo final ausente`);
    } else {
      try {
        dim = await dimensoes(arquivo);
        if (dim.width !== LARGURA || dim.height !== ALTURA) {
          erros.push(`${equip.patrimonio}: ${dim.width}x${dim.height}, esperado ${LARGURA}x${ALTURA}`);
        }
        if (dim.format !== 'jpeg') erros.push(`${equip.patrimonio}: formato ${dim.format}, esperado jpeg`);
      } catch (erro) {
        erros.push(`${equip.patrimonio}: arquivo ilegivel (${erro.message})`);
      }
    }

    const decisao = revisao[id];
    let revisaoStatus = 'pendente';
    if (decisao?.status === 'aprovada') revisaoStatus = 'aprovada';
    else if (decisao?.status === 'reprovada') {
      revisaoStatus = 'reprovada';
      erros.push(`${equip.patrimonio}: foto ${id} reprovada em revisao.json (${decisao.motivo}); rode preparar`);
    } else {
      pendentes.push(equip.patrimonio);
      if (exigirRevisao) erros.push(`${equip.patrimonio}: foto ${id} sem revisao humana`);
    }

    itens.push({ patrimonio: equip.patrimonio, id, user: px.user, dim, arquivo, revisao: revisaoStatus });
  }
  return { itens, erros, pendentes };
}

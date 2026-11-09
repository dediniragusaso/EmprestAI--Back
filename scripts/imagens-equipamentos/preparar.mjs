// Busca no Pixabay, baixa, recorta (cover) e redimensiona para 800x600.
// Uso: npm run imagens:preparar   (a chave vem de back/.env via node --env-file)
import { createHash } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  ALTURA, CACHE_DIR, EQUIPAMENTOS_PATH, FINAL_DIR, LARGURA, LICENCA, MANIFESTO_PATH,
  dimensoes, existe, falhar, idsReprovados, lerJson, lerRevisao, redigir,
} from './lib.mjs';

const API = 'https://pixabay.com/api/';
const CACHE_MS = 24 * 60 * 60 * 1000; // regra do Pixabay: cache de 24 h
const MAX_DOWNLOADS_POR_EQUIPAMENTO = 10; // sem download em massa

const chaveApi = process.env.PIXABAY_API_KEY;
if (!chaveApi) falhar('PIXABAY_API_KEY ausente. Defina em back/.env (so o nome esta em .env.example).');

const hostPixabay = (host) => host === 'pixabay.com' || host.endsWith('.pixabay.com');

async function buscar(equip) {
  const parametros = new URLSearchParams({
    q: equip.busca,
    image_type: 'photo',
    orientation: 'horizontal',
    min_width: String(LARGURA),
    min_height: String(ALTURA),
    safesearch: 'true',
    order: 'popular',
    per_page: '30',
  }).toString();
  const arquivoCache = path.join(CACHE_DIR, `${createHash('sha1').update(parametros).digest('hex')}.json`);

  if (await existe(arquivoCache)) {
    const cache = await lerJson(arquivoCache);
    if (Date.now() - cache.buscadoEm < CACHE_MS) return { hits: cache.hits, doCache: true };
  }

  const resposta = await fetch(`${API}?key=${encodeURIComponent(chaveApi)}&${parametros}`, {
    headers: { Accept: 'application/json' },
  });
  if (resposta.status === 429) {
    throw new Error(`Pixabay 429 (limite de requisicoes); aguarde ${resposta.headers.get('x-ratelimit-reset') ?? '?'} s`);
  }
  if (!resposta.ok) throw new Error(`Pixabay respondeu HTTP ${resposta.status}`);
  const json = await resposta.json();
  await mkdir(CACHE_DIR, { recursive: true });
  // O cache guarda so a resposta; a chave nunca entra no arquivo.
  await writeFile(arquivoCache, JSON.stringify({ buscadoEm: Date.now(), hits: json.hits }));
  return { hits: json.hits, doCache: false };
}

async function baixar(url) {
  const alvo = new URL(url);
  if (alvo.protocol !== 'https:' || !hostPixabay(alvo.hostname)) {
    throw new Error(`origem recusada (${alvo.hostname}); so Pixabay`);
  }
  const resposta = await fetch(alvo);
  if (!resposta.ok) throw new Error(`download HTTP ${resposta.status}`);
  return Buffer.from(await resposta.arrayBuffer());
}

async function escolher(equip, usados, reprovados) {
  const { hits, doCache } = await buscar(equip);
  const log = [];
  let downloads = 0;
  for (const hit of hits) {
    const id = String(hit.id);
    if (reprovados.has(id)) { log.push(`${id}: reprovada em revisao.json`); continue; }
    if (usados.has(id)) { log.push(`${id}: ja usada (${usados.get(id)})`); continue; }
    if (hit.type && hit.type !== 'photo') continue;
    if (downloads >= MAX_DOWNLOADS_POR_EQUIPAMENTO) { log.push('limite de downloads atingido'); break; }
    downloads += 1;

    let origem;
    try {
      origem = await baixar(hit.largeImageURL);
    } catch (erro) {
      log.push(`${id}: ${redigir(erro.message)}`);
      continue;
    }
    const meta = await sharp(origem).metadata();
    const trocado = meta.orientation >= 5; // EXIF gira 90 graus
    const largura = trocado ? meta.height : meta.width;
    const altura = trocado ? meta.width : meta.height;
    if (largura < LARGURA || altura < ALTURA) {
      log.push(`${id}: origem ${largura}x${altura} < ${LARGURA}x${ALTURA}`);
      continue;
    }

    const saida = await sharp(origem)
      .rotate()
      .resize(LARGURA, ALTURA, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer();
    const arquivo = path.join(FINAL_DIR, `${equip.patrimonio}.jpg`);
    await mkdir(FINAL_DIR, { recursive: true });
    await writeFile(arquivo, saida);

    // Validacao do arquivo gravado, nao da expectativa.
    const dim = await dimensoes(arquivo);
    if (dim.width !== LARGURA || dim.height !== ALTURA) {
      await rm(arquivo, { force: true });
      throw new Error(`${equip.patrimonio}: arquivo final ${dim.width}x${dim.height}, esperado ${LARGURA}x${ALTURA}`);
    }

    return {
      doCache,
      item: {
        patrimonio: equip.patrimonio,
        nome: equip.nome,
        busca: equip.busca,
        pixabay: {
          id: hit.id,
          pageURL: hit.pageURL,
          user: hit.user,
          user_id: hit.user_id,
          tags: hit.tags,
          origem: { width: largura, height: altura },
        },
        licenca: LICENCA,
        arquivo: `final/${equip.patrimonio}.jpg`,
        dimensoes: { width: dim.width, height: dim.height },
        sha256: createHash('sha256').update(saida).digest('hex'),
        preparadoEm: new Date().toISOString(),
      },
    };
  }
  throw new Error(`${equip.patrimonio}: nenhuma foto aproveitavel para "${equip.busca}". ${log.slice(0, 8).join(' | ')}`);
}

async function main() {
  const equipamentos = await lerJson(EQUIPAMENTOS_PATH);
  const reprovados = idsReprovados(await lerRevisao());
  const anterior = await lerJson(MANIFESTO_PATH, { itens: [] });

  // Mantem o que ja foi escolhido (rodar de novo nao troca foto), exceto reprovada,
  // arquivo ausente ou id duplicado.
  const mantidos = new Map();
  const usados = new Map();
  for (const equip of equipamentos) {
    const item = (anterior.itens ?? []).find((i) => i.patrimonio === equip.patrimonio);
    if (!item) continue;
    const id = String(item.pixabay?.id);
    const arquivo = path.join(FINAL_DIR, `${equip.patrimonio}.jpg`);
    if (reprovados.has(id) || usados.has(id) || !(await existe(arquivo))) continue;
    mantidos.set(equip.patrimonio, item);
    usados.set(id, equip.patrimonio);
  }

  const itens = [];
  const falhas = [];
  for (const equip of equipamentos) {
    if (mantidos.has(equip.patrimonio)) {
      itens.push(mantidos.get(equip.patrimonio));
      console.log(`${equip.patrimonio}: mantida (id ${mantidos.get(equip.patrimonio).pixabay.id})`);
      continue;
    }
    try {
      const { item, doCache } = await escolher(equip, usados, reprovados);
      usados.set(String(item.pixabay.id), equip.patrimonio);
      itens.push(item);
      console.log(`${equip.patrimonio}: id ${item.pixabay.id} (${doCache ? 'busca do cache' : 'busca na API'})`);
    } catch (erro) {
      falhas.push(redigir(erro.message));
      console.error(`${equip.patrimonio}: FALHOU`);
    }
  }

  await mkdir(path.dirname(MANIFESTO_PATH), { recursive: true });
  await writeFile(MANIFESTO_PATH, `${JSON.stringify({ geradoEm: new Date().toISOString(), itens }, null, 2)}\n`);
  if (falhas.length) {
    falhar(`\n${falhas.length} equipamento(s) sem foto:\n- ${falhas.join('\n- ')}`);
  }
  console.log(`\n${itens.length} fotos preparadas em ${LARGURA}x${ALTURA}. Proximo: npm run imagens:validar`);
}

main().catch((erro) => falhar(`preparar falhou: ${erro.message}`));

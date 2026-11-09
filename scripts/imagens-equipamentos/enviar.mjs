// Envia as fotos finais ao Storage do Supabase com upsert em caminho fixo:
//   bucket "imagens" (publico) / equipamentos/<patrimonio>.jpg
// Rodar duas vezes nao duplica: o mesmo caminho e sobrescrito.
//
// REMOTO (producao): so o operador, no terminal dele, com a service role e
// ENVIAR_CONFIRMO_PRODUCAO=sim. O agente so roda contra o Supabase LOCAL.
// Uso: npm run imagens:enviar [-- --ignorar-revisao]   (--ignorar-revisao so no local)
import { readFile } from 'node:fs/promises';
import { falhar, redigir, validarTudo } from './lib.mjs';

const BUCKET = 'imagens';
const PREFIXO = 'equipamentos';

const base = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base) falhar('SUPABASE_URL ausente.');
if (!servico) falhar('SUPABASE_SERVICE_ROLE_KEY ausente. Rode no seu terminal, com a service role.');

const host = new URL(base).hostname;
const local = host === '127.0.0.1' || host === 'localhost';
const ignorarRevisao = process.argv.includes('--ignorar-revisao');

if (!local && process.env.ENVIAR_CONFIRMO_PRODUCAO !== 'sim') {
  falhar(`Destino REMOTO (${host}). Producao so pelo operador: defina ENVIAR_CONFIRMO_PRODUCAO=sim no seu terminal.`);
}
if (!local && ignorarRevisao) falhar('--ignorar-revisao so e aceito contra o Supabase local.');

const cabecalhos = { Authorization: `Bearer ${servico}`, apikey: servico };

async function chamar(caminho, opcoes = {}) {
  const resposta = await fetch(`${base}/storage/v1${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhos, ...(opcoes.headers ?? {}) },
  });
  const texto = await resposta.text();
  return { status: resposta.status, ok: resposta.ok, texto };
}

async function garantirBucket() {
  const atual = await chamar(`/bucket/${BUCKET}`);
  if (atual.ok) {
    if (JSON.parse(atual.texto).public !== true) {
      falhar(`Bucket "${BUCKET}" existe mas NAO e publico; nao alterei. Corrija antes de enviar.`);
    }
    return 'ja existia';
  }
  const criado = await chamar('/bucket', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 5242880, allowed_mime_types: ['image/jpeg'] }),
  });
  if (!criado.ok) falhar(`Falha ao criar bucket (HTTP ${criado.status}): ${criado.texto}`);
  return 'criado';
}

async function main() {
  const { itens, erros } = await validarTudo({ exigirRevisao: !ignorarRevisao });
  if (erros.length) falhar(`Nao envio: ${erros.length} problema(s):\n- ${erros.join('\n- ')}`);

  console.log(`Destino: ${host} (${local ? 'LOCAL' : 'REMOTO, confirmado pelo operador'}); revisao ${ignorarRevisao ? 'IGNORADA (teste local)' : 'exigida'}`);
  console.log(`Bucket "${BUCKET}": ${await garantirBucket()}`);

  for (const item of itens) {
    const destino = `${PREFIXO}/${item.patrimonio}.jpg`;
    const resposta = await chamar(`/object/${BUCKET}/${destino}`, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': 'max-age=3600' },
      body: await readFile(item.arquivo),
    });
    if (!resposta.ok) falhar(`${destino}: HTTP ${resposta.status} ${resposta.texto}`);
    console.log(`  ${destino}: ok`);
  }

  const lista = await chamar(`/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: PREFIXO, limit: 1000, offset: 0 }),
  });
  if (!lista.ok) falhar(`Falha ao listar (HTTP ${lista.status}): ${lista.texto}`);
  const nomes = JSON.parse(lista.texto).map((o) => o.name).sort();
  const esperados = itens.map((i) => `${i.patrimonio}.jpg`).sort();
  const igual = nomes.length === esperados.length && nomes.every((n, k) => n === esperados[k]);
  console.log(`\nObjetos em ${BUCKET}/${PREFIXO}: ${nomes.length} (esperado ${esperados.length}) ${igual ? 'OK, sem duplicata' : 'DIVERGENTE'}`);
  console.log(`URL publica de exemplo: ${base}/storage/v1/object/public/${BUCKET}/${PREFIXO}/${itens[0].patrimonio}.jpg`);
  if (!igual) process.exit(1);
}

main().catch((erro) => falhar(`enviar falhou: ${redigir(erro.message)}`));

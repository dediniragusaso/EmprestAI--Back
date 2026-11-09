// Gera creditos.json (versionado) a partir do manifesto, so depois de validar com revisao completa.
// Uso: npm run imagens:creditos
// Sem segredo e sem dado pessoal alem do nome de autor que o Pixabay publica: nao leva user_id.
// Sem data/hora: rodar de novo sobre o mesmo manifesto nao gera diff.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LICENCA, MANIFESTO_PATH, SCRIPT_DIR, falhar, lerJson, validarTudo } from './lib.mjs';

const CREDITOS_PATH = path.join(SCRIPT_DIR, 'creditos.json');

const { erros } = await validarTudo({ exigirRevisao: true });
if (erros.length) falhar(`Nao gero creditos: ${erros.length} problema(s):\n- ${erros.join('\n- ')}`);

const manifesto = await lerJson(MANIFESTO_PATH);
const creditos = manifesto.itens
  .map((i) => ({
    patrimonio: i.patrimonio,
    pixabayId: i.pixabay.id,
    autor: i.pixabay.user,
    pageURL: i.pixabay.pageURL,
    licenca: i.licenca ?? LICENCA,
  }))
  .sort((a, b) => a.patrimonio.localeCompare(b.patrimonio));

await writeFile(CREDITOS_PATH, `${JSON.stringify(creditos, null, 2)}\n`);
console.log(`creditos.json: ${creditos.length} equipamentos`);

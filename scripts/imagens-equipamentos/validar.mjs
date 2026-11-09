// Confere manifesto, arquivos finais (800x600 JPEG), ids unicos e revisao humana.
// Uso: npm run imagens:validar [-- --exigir-revisao]
import { validarTudo } from './lib.mjs';

const exigirRevisao = process.argv.includes('--exigir-revisao');
const { itens, erros, pendentes } = await validarTudo({ exigirRevisao });

console.log('patrimonio  id           autor              dimensoes  revisao');
for (const i of itens) {
  const dim = i.dim ? `${i.dim.width}x${i.dim.height}` : '-';
  console.log(`${i.patrimonio.padEnd(11)} ${String(i.id).padEnd(12)} ${String(i.user).slice(0, 18).padEnd(18)} ${dim.padEnd(10)} ${i.revisao}`);
}
if (pendentes.length && !exigirRevisao) {
  console.log(`\nAviso: ${pendentes.length} foto(s) sem revisao humana em revisao.json (enviar exige).`);
}
if (erros.length) {
  console.error(`\n${erros.length} erro(s):\n- ${erros.join('\n- ')}`);
  process.exit(1);
}
console.log('\nvalidar OK');

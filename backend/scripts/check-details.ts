/**
 * 자격증 설명 JSON 검사. npm run check:details
 * 형식 오류·중복 id·목록에 없는 id 찾음. 오류 있으면 exit 1.
 */
import { CATALOG } from '../src/cert/catalog';
import { DETAILS_DIR, loadDetails } from '../src/cert/details';

const { details, issues } = loadDetails(DETAILS_DIR);
const ids = new Set(CATALOG.map((c) => c.id));
const unknown = Object.keys(details).filter((id) => !ids.has(id));
for (const i of issues) console.log(`오류  ${i.file}  ${i.id}: ${i.msg}`);
for (const id of unknown) console.log(`모름  ${id}: 자격증 목록(CATALOG)에 없는 id`);
const done = Object.keys(details).length - unknown.length;
console.log(`설명 ${done} / 자격증 ${ids.size} (${((done / ids.size) * 100).toFixed(1)}%). 오류 ${issues.length + unknown.length}`);
if (process.argv.includes('--missing')) {
  for (const c of CATALOG) if (!details[c.id]) console.log(`없음  ${c.id}  ${c.name}  [${c.kind}/${c.field ?? '기타'}]`);
}
process.exit(issues.length + unknown.length ? 1 : 0);

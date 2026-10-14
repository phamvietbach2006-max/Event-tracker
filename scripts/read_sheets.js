import { writeFileSync } from 'node:fs';

async function check(id, title) {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/htmlview`);
  const text = await res.text();
  const re = /id="sheet-button-([0-9]+)"[^>]*>([^<]+)/g;
  const tabs = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    tabs.push({ gid: match[1], name: match[2].trim() });
  }
  console.log(`=== ${title} (${id}) ===`);
  console.log('Tabs:', tabs);

  if (tabs.length === 0) {
    // Single sheet, export gid=0
    const csv = await (await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`)).text();
    writeFileSync(`scripts/${title}_default.csv`, csv, 'utf8');
    console.log(`Saved default CSV (${csv.length} bytes)`);
  } else {
    for (const t of tabs) {
      const csv = await (await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${t.gid}`)).text();
      writeFileSync(`scripts/${title}_${t.name.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')}_${t.gid}.csv`, csv, 'utf8');
      console.log(`Saved ${t.name} (gid ${t.gid}): ${csv.length} bytes`);
    }
  }
}

async function main() {
  await check('12ipZ_Xma-6Pse9A71B7KW1S9TgQXyHfDYXSeVAFnqxI', 'Sheet1_NhanSuMang');
  await check('101ZERtuxQp_paZbjB4zn9q8nrsdOT_CD2sLt3N5JYbo', 'Sheet2_CanBoCTV');
}

main().catch(console.error);

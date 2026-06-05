/**
 * Seed learning content from data.ts files into the database.
 * Run in Docker: docker exec wangsh-frontend npx tsx scripts/seed-learning.ts
 * Or from frontend dir: npx tsx scripts/seed-learning.ts
 */
const API_BASE = "http://backend:8000";
const adminPassword = process.env.SUPER_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  throw new Error("请先设置 SUPER_ADMIN_PASSWORD 或 ADMIN_PASSWORD 环境变量");
}
const AUTH = { username: "admin", password: adminPassword };

async function upsert(mod: string, section: string, key: string, data: any, sort = 0) {
  const title = data.name || data.label || data.title || key;
  const summary = data.description || data.data || data.goal || "";

  const body = {
    title,
    summary,
    content: data,
    tags: [],
    difficulty: data.difficulty || "",
    sort_order: sort,
    enabled: true,
    source_type: "seed",
    section_key: section,
    item_key: key,
  };

  const res = await fetch(`${API_BASE}/api/v1/learning/content/${mod}/${section}/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Basic " + Buffer.from(`${AUTH.username}:${AUTH.password}`).toString("base64")
    },
    body: JSON.stringify(body),
  });

  const status = res.ok ? "OK" : `ERR ${res.status}`;
  console.log(`  ${status}: ${mod}/${section}/${key}`);
}

async function seedModule(mod: string) {
  console.log(`\n--- Seeding ${mod} ---`);

  const modPath = `../src/pages/Admin/ITTechnology/${mod}`;
  let data: any;
  try {
    data = await import(`${modPath}/data`);
  } catch (e) {
    console.log(`  SKIP: cannot import ${modPath}/data`);
    return;
  }

  // Roadmap stages
  const stages = data.ROADMAP_STAGES || data.roadmapStages || [];
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    await upsert(mod, "roadmap", s.id || s.name || `stage_${i}`, s, i);
  }

  // Knowledge tree
  const tree = data.KNOWLEDGE_TREE || data.knowledgeTree || [];
  function flatten(nodes: any[], depth = 0): any[] {
    let result: any[] = [];
    for (const n of nodes) {
      const id = n.id || n.label;
      result.push({ ...n, _depth: depth });
      if (n.children) result.push(...flatten(n.children, depth + 1));
    }
    return result;
  }
  const flatTree = flatten(Array.isArray(tree) ? tree : []);
  for (let i = 0; i < flatTree.length; i++) {
    const n = flatTree[i];
    await upsert(mod, "knowledge", n.id || n.label || `node_${i}`, n, i);
  }

  // Experiments
  const experiments = data.EXPERIMENTS || data.experimentLevels || {};
  let expIdx = 0;
  if (Array.isArray(experiments)) {
    for (const e of experiments) {
      await upsert(mod, "experiments", e.name || `exp_${expIdx}`, e, expIdx++);
    }
  } else {
    for (const [level, exps] of Object.entries(experiments)) {
      if (Array.isArray(exps)) {
        for (const e of exps) {
          await upsert(mod, "experiments", e.name || `exp_${expIdx}`, e, expIdx++);
        }
      }
    }
  }

  // Tools
  const tools = data.TOOLS_DATA || data.toolsData || [];
  for (let i = 0; i < tools.length; i++) {
    const t = tools[i];
    await upsert(mod, "tools", t.name || `tool_${i}`, t, i);
  }

  // Resources
  const resources = data.RESOURCES_DATA || data.resourcesData || [];
  for (let i = 0; i < resources.length; i++) {
    const r = resources[i];
    await upsert(mod, "resources", r.title || `resource_${i}`, r, i);
  }

  console.log(`  ✅ ${mod} done`);
}

async function main() {
  console.log("Seeding learning content to database...\n");

  for (const mod of ["ml", "ai", "agents"]) {
    await seedModule(mod);
  }

  console.log("\n✅ All modules seeded!");
}

main().catch(console.error);

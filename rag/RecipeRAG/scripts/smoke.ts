/* RecipeRAG/scripts/smoke.ts */
/*import 'dotenv/config';

// import from src so we don’t need a build first
import UnityDocsSearch from '../src/tools/UnityDocsSearch';
import UnityListVersions from '../src/tools/UnityListVersions';
import UnitySetIndexDir from '../src/tools/UnitySetIndexDir';
import UnitySnippetsGetAll from '../src/tools/UnitySnippetsGetAll';
import UnitySnippetsByTag from '../src/tools/UnitySnippetsByTag';
import UnitySnippetsIndex from '../src/tools/UnitySnippetsIndex';
import UnityDetectProjectVersion from '../src/tools/UnityDetectProjectVersion';

async function run(name: string, f: () => Promise<any>) {
	try {
		const res = await f();
		console.log(`\n=== ${name} OK ===`);
		console.log(typeof res === 'string' ? res : JSON.stringify(res, null, 2));
	} catch (err: any) {
		console.error(`\n*** ${name} FAILED ***`);
		console.error(err?.message || err);
		process.exitCode = 1;
	}
}

async function main() {
	// Ensure backend URL is set
	const base = process.env.UNITY_RAG_BASE_URL || 'http://127.0.0.1:8000';
	console.log(`Backend: ${base}`);

	await run('unity_list_versions', async () => {
		const t = new UnityListVersions();
		return t.execute({} as any);
	});

	await run('unity_docs_search', async () => {
		const t = new UnityDocsSearch();
		return t.execute({ q: 'Rigidbody.AddForce', top_k: 3 });
	});

	// Snippets are optional; expect [] / placeholder until you add files
	await run('unity_snippets_get_all', async () => {
		const t = new UnitySnippetsGetAll();
		return t.execute({} as any);
	});

	await run('unity_snippets_by_tag(physics)', async () => {
		const t = new UnitySnippetsByTag();
		return t.execute({ tag: 'physics' });
	});

	await run('unity_snippets_index', async () => {
		const t = new UnitySnippetsIndex();
		return t.execute({} as any);
	});

	// Optional: project version detection (requires a real project path)
	const projectPath = process.env.UNITY_PROJECT_PATH;
	if (projectPath) {
		await run('unity_detect_project_version', async () => {
		const t = new UnityDetectProjectVersion();
		return t.execute({ project_path: projectPath });
		});
	} else {
		console.log('\n(Skipping unity_detect_project_version — set UNITY_PROJECT_PATH to test)');
	}
}

main().catch((e) => {
	console.error('Smoke test crashed:', e);
	process.exit(1);
});
*/
// scripts/smoke.ts
import 'dotenv/config';

import UnityDocsSearch from '../src/tools/UnityDocsSearch';
import UnityListVersions from '../src/tools/UnityListVersions';
import UnitySetIndexDir from '../src/tools/UnitySetIndexDir';
import UnitySnippetsGetAll from '../src/tools/UnitySnippetsGetAll';
import UnitySnippetsByTag from '../src/tools/UnitySnippetsByTag';
import UnitySnippetsIndex from '../src/tools/UnitySnippetsIndex';
import UnityDetectProjectVersion from '../src/tools/UnityDetectProjectVersion';

async function run(name: string, fn: () => Promise<any>) {
	try {
		const res = await fn();
		console.log(`\n=== ${name} OK ===`);
		console.log(typeof res === 'string' ? res : JSON.stringify(res, null, 2));
	} catch (e: any) {
		console.error(`\n*** ${name} FAILED ***`);
		console.error(e?.message || e);
		process.exitCode = 1;
	}
}

(async function main() {
	const base = process.env.UNITY_RAG_BASE_URL || 'http://127.0.0.1:8000';
	console.log(`Backend: ${base}`);

	await run('unity_list_versions', async () => new UnityListVersions({ baseUrl: base }).execute({}));
	await run('unity_docs_search', async () => new UnityDocsSearch({ baseUrl: base }).execute({ q: 'Rigidbody.AddForce', top_k: 3 }));
	await run('unity_snippets_get_all', async () => new UnitySnippetsGetAll().execute({}));
	await run('unity_snippets_by_tag(physics)', async () => new UnitySnippetsByTag().execute({ tag: 'physics' }));
	await run('unity_snippets_index', async () => new UnitySnippetsIndex().execute({}));

	const projectPath = process.env.UNITY_PROJECT_PATH;
	if (projectPath) {
		await run('unity_detect_project_version', async () =>
			new UnityDetectProjectVersion().execute({ project_path: projectPath })
		);
	} else {
		console.log('\n(Skipping unity_detect_project_version — set UNITY_PROJECT_PATH to test)');
	}
})();

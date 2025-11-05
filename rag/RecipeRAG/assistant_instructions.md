# Assistant Instructions: Use UnityRAG for Unity Projects

When helping with **Unity** projects, follow this order:

1. **Detect project version** — call `unity_detect_project_version(project_path)` if known; else default to Unity 6 (6000.x).
2. **Curated best-practice first** — `unity_snippets_by_tag(tag)` or `unity_snippets_get_all()`; include code blocks & explanations.
3. **Fallback to full docs (RAG)** — `unity_docs_search(q, version?)` for manual/API details and edge cases.
4. **Version-aware answers** — prefer 6000.x; add 2022.3 legacy notes only if behavior/API differs.
5. **Performance & complexity** — surface `performance_impact` and `complexity` fields when available.
6. **Switch datasets at runtime** — `unity_set_index_dir(index_dir)` if the backend points at the wrong docs set.
7. **Never leak local filesystem paths** — summarize locations generically (e.g., “local manual page”).

Example flow:
- “How do I add force to a Rigidbody?” → snippets: `physics` → else docs search with `Rigidbody.AddForce`.

# RecipeRAG Curated Snippets — Index

> Badges: [Bad vs Good] · [Performance: low|medium|high] · [Complexity: beginner|intermediate|advanced] · [Unity: version-gate(s)]

---

## physics
- Physics-based movement with Rigidbody (AddForce) — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Prevent tunneling with continuous collision detection — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- CharacterController for player movement (physics-free) — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Rigidbody.MovePosition for kinematic step movement — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Choose the right ForceMode (Impulse/Acceleration/VelocityChange) — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Prevent tunneling with Continuous/ContinuousDynamic CCD — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.2+, 2022.3 (legacy)]
- Use Rigidbody interpolation for smooth visuals — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Rigidbody.Sleep and WakeUp for optimization — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Use Physics.IgnoreCollision for projectiles — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Use Rigidbody constraints to lock unused axes — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Use Physics layers & queries instead of tag checks — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Use Rigidbody2D.MovePosition for 2D physics movement — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Use Physics.RaycastNonAlloc to reduce GC — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]
- Use Rigidbody2D interpolation for smooth visuals — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Use Physics.OverlapSphereNonAlloc for area checks — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]
- Use AddTorque for rotation (don’t rotate Transform) — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Do physics work in FixedUpdate (not Update) — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- QueryTriggerInteraction for precise raycasts — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Use PhysicsScene for deterministic local queries — [Bad vs Good] [Performance: low] [Complexity: advanced] [Unity: 6000.0+]
- Ignore layer collisions globally — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- CapsuleCast for character feet check — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]
- Use Rigidbody.useGravity instead of manual gravity — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Choose trigger vs collision callbacks correctly — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- 2D: CompositeCollider2D to merge tiles — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- Use Rigidbody.maxLinearVelocity to clamp speed — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.1+]
- Bounds / OverlapBox for area logic — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]

---

## input
- Action-based Input vs Legacy Input Manager — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Input System: runtime rebinding (action-based) — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Use InputAction callbacks instead of polling — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- PlayerInput component for input routing — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Composite bindings for WASD/Arrow keys — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Enable/Disable InputActionMaps for mode switching — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Control schemes & device auto-switch — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- Input buffering with Input System — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]

---

## scripting
- Use ScriptableObjects for shared data and configuration — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Use events to decouple systems (event-driven vs polling) — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Coroutines vs async/await (Awaitable) — [Bad vs Good] [Performance: low] [Complexity: advanced] [Unity: 6000.1+, 2022.3 (legacy)]
- Inject dependencies via references (avoid global lookups) — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Frame-rate independent movement (Time.deltaTime) — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Coroutine cancellation via StopCoroutine — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- WaitUntil/WaitWhile for coroutine conditions — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- OnValidate to auto-clamp values — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- TryGetComponent to avoid exceptions — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- SerializeField on private fields (encapsulation) — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Awake vs Start ordering — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Interfaces + RequireComponent — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- Mathf.Approximately for float comparisons — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Time.unscaledDeltaTime for pause-aware UI — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Color32 for byte-driven colors — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]
- StringBuilder for looped concatenation — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]

---

## ui / ui-toolkit / ugui / text / localization
- UI Toolkit: Reduce overdraw with proper batching — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.2+]
- Use TextMeshPro for text rendering — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- UGUI: split large Canvases to avoid full rebuilds — [Bad vs Good] [Performance: high] [Complexity: beginner] [Unity: 6000.0+]
- TMP: avoid Auto Size on many labels — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- UI Toolkit: bind SerializedObject for inspector-like UIs — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.2+]
- World-space UI for HUDs (prefer overlay) — [Bad vs Good] [Performance: high] [Complexity: beginner] [Unity: 6000.0+]
- TMP object pooling for chat logs — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- World-space UI: CanvasScaler constant pixel size — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- WaitForEndOfFrame for UI capture — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- UI Toolkit ListView with virtualization — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.2+]
- UGUI: Avoid LayoutGroup thrash on large lists — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- CanvasGroup for fade & interactivity — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- TMP.SetText to reduce allocations — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- Localization: LocalizedString usage — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- UI Toolkit: style via class lists (avoid inline styles) — [Bad vs Good] [Performance: high] [Complexity: beginner] [Unity: 6000.2+]
- World-space UI: disable Raycast Target on visuals — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]

---

## editor / inspector / tools / pipeline
- Editor scripting: MenuItem for utilities — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- PropertyDrawer: validate fields inline — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.2+, 2022.3 (legacy)]
- Custom Inspector with UI Toolkit — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.1+, 2022.3 (legacy)]
- EditorWindow utility panel — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.1+, 2022.3 (legacy)]
- Custom inspector: use SerializedProperty — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- InitializeOnLoad for auto editor setup — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- AssetPostprocessor: auto-import settings — [Bad vs Good] [Performance: low] [Complexity: advanced] [Unity: 6000.0+]
- BuildPipeline: scripted builds — [Bad vs Good] [Performance: low] [Complexity: advanced] [Unity: 6000.0+]
- Undo.RecordObject for editor changes — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- EditorCoroutineUtility for editor-time tasks — [Bad vs Good] [Performance: low] [Complexity: advanced] [Unity: 6000.0+]
- MenuItem validate function — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- ExecuteAlways with care — [Bad vs Good] [Performance: medium] [Complexity: advanced] [Unity: 6000.0+]
- Remove empty Unity event methods — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]

---

## performance / jobs / profiling / gc
- Object Pooling vs frequent Instantiate/Destroy — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Cache component references to avoid per-frame lookups — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Use CompareTag instead of string comparisons — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Leverage C# Job System & Burst — [Bad vs Good] [Performance: high] [Complexity: advanced] [Unity: 6000.0+, 2022.3 (legacy)]
- Jobs: NativeArray with Dispose — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- Jobs: BurstCompile attribute — [Bad vs Good] [Performance: high] [Complexity: advanced] [Unity: 6000.0+]
- Avoid FindObjectOfType in Update — [Bad vs Good] [Performance: high] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Avoid LINQ/allocations in Update — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- Cache WaitForSeconds / WaitForEndOfFrame — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- ProfilerMarker for custom profiling — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]

---

## scene / loading / assets / addressables / lifecycle
- Load scenes asynchronously to avoid frame stalls — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Persist singletons with DontDestroyOnLoad — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Use Addressables for large assets instead of Resources — [Bad vs Good] [Performance: medium] [Complexity: advanced] [Unity: 6000.0+, 2022.3 (legacy)]
- SceneManager.sceneLoaded event instead of polling — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Addressables: release handles to free memory — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Additive scene loading + clean unload — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Async SceneManager.LoadSceneAsync with await — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.1+]
- Addressables: Async handle await pattern — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- Addressables: instantiate directly from handle — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- Addressables: dependency preloading (warmup) — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- Addressables: ReleaseInstance for spawned prefabs — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]
- SetActiveScene after additive load — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- Scene cleanup hooks — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- DontDestroyOnLoad for managers — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Async scene loading with progress bar — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]

---

## ai / navigation / movement
- Use NavMeshAgent for pathfinding — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- NavMeshAgent: Stop and Resume — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- NavMesh: area costs to steer agents — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Use NavMesh.SamplePosition to clamp target — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- OffMeshLink traversal coroutine — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- NavMeshAgent avoidance priority — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Ground check: raycast vs OnCollisionStay — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- CharacterController: slope limit & step offset — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Physics layers for hitscan weapons — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- Simple steering: desired - velocity — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- NavMeshObstacle with carving for dynamic blockers — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]

---

## graphics / rendering / lighting / shader-graph / urp / hdrp
- Avoid unnecessary material instances (use shared or MPB) — [Bad vs Good] [Performance: high] [Complexity: advanced] [Unity: 6000.0+, 2022.3 (legacy)]
- SRP Batcher + MaterialPropertyBlock (preserve batching) — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.1+, 2022.3 (legacy)]
- Use CommandBuffer for custom rendering passes — [Bad vs Good] [Performance: high] [Complexity: advanced] [Unity: 6000.2+]
- Shader Graph: use keywords for feature toggles — [Bad vs Good] [Performance: medium] [Complexity: advanced] [Unity: 6000.0+]
- Material GPU Instancing toggle — [Bad vs Good] [Performance: high] [Complexity: beginner] [Unity: 6000.0+]
- SRP per-camera volumes (post effects isolation) — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]
- CommandBuffer: AfterForwardOpaque decals — [Bad vs Good] [Performance: high] [Complexity: advanced] [Unity: 6000.2+]
- Static batching for static geometry — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- Occlusion Culling bake for dense scenes — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- Reflection Probes: box projection for interiors — [Bad vs Good] [Performance: medium] [Complexity: advanced] [Unity: 6000.0+]
- Lighting: Mixed lights for static + dynamic — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]
- Mesh.CombineMeshes for static props — [Bad vs Good] [Performance: high] [Complexity: advanced] [Unity: 6000.0+]
- MaterialPropertyBlock for per-object color — [Bad vs Good] [Performance: high] [Complexity: intermediate] [Unity: 6000.0+]

---

## multiplayer / netcode
- Use server-authoritative network code (NetworkVariable + ServerRpc) — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- Netcode: NetworkTransform for transform sync — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Netcode: Use ServerRpc & ClientRpc correctly — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- NetworkTransform for transform sync (don’t DIY in Update) — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- ClientRpcParams to target specific clients — [Bad vs Good] [Performance: medium] [Complexity: intermediate] [Unity: 6000.0+]
- NetworkVariable with permissions — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- NetworkPrefab registration — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- Ownership checks before input — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- NGO: Spawn/Despawn server-side — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- NGO: ChangeOwnership for pickups/possession — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- NetworkVariable.OnValueChanged subscription — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- NetworkSceneManager for synchronized scene switches — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]

---

## architecture (scriptableobject / events / DI)
- ScriptableObject event channel (decouple broadcast/listen) — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+, 2022.3 (legacy)]
- ScriptableObject as runtime data container — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]
- ScriptableObject singleton configs — [Bad vs Good] [Performance: low] [Complexity: intermediate] [Unity: 6000.0+]
- ScriptableObject inventory definitions — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]

---

## basics / lookup / misc
- Use CompareTag instead of string tag compare — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+, 2022.3 (legacy)]
- Avoid per-frame GetComponentInChildren — [Bad vs Good] [Performance: medium] [Complexity: beginner] [Unity: 6000.0+]
- Avoid Camera.main in Update (cache it) — [Bad vs Good] [Performance: low] [Complexity: beginner] [Unity: 6000.0+]

-- SQLite
SELECT name FROM sqlite_master WHERE type='table';
SELECT COUNT(*) FROM recipe;
SELECT * FROM recipe LIMIT 5;


-- key 매핑 정확성 확인
SELECT r.recipe_id, r.title, r.author, r.servings, r.total_time, r.difficulty
FROM recipe r ORDER BY r.created_at DESC LIMIT 3;

SELECT step_no, text FROM step WHERE recipe_id = '<id>' ORDER BY step_no;
SELECT section, COUNT(*) FROM chunk WHERE recipe_id = '<id>' GROUP BY section;
SELECT length(raw_json) FROM recipe_doc WHERE recipe_id = '<id>';

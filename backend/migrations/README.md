# 🗄️ Database Migrations Guide

## 📋 Overview

This folder contains database migration scripts for the new architecture.

## 🎯 Migration Files

1. **001_create_cleaned_recipes.sql** - Cleaned Recipe Database
   - `cleaned_recipes` table (planning metadata)
   - `cleaned_steps` table (voice scripts)

2. **002_create_sessions.sql** - Session/State Database
   - `cooking_sessions` table (cooking progress)
   - `session_states` table (event logging)

---

## 🚀 How to Execute Migrations

### **Method 1: Using psql command line**

```bash
# Navigate to backend folder
cd c:\Sogang\last_project\backend

# Execute migration 001
psql -U postgres -d recipe_db -f migrations/001_create_cleaned_recipes.sql

# Execute migration 002
psql -U postgres -d recipe_db -f migrations/002_create_sessions.sql
```

**Password**: `yorijori`

---

### **Method 2: Using pgAdmin (GUI)**

1. Open **pgAdmin**
2. Connect to PostgreSQL server
3. Navigate to: **Servers** → **PostgreSQL** → **Databases** → **recipe_db**
4. Right-click on **recipe_db** → **Query Tool**
5. Open file: `migrations/001_create_cleaned_recipes.sql`
6. Click **Execute** (F5)
7. Repeat for `migrations/002_create_sessions.sql`

---

### **Method 3: Using DBeaver (GUI)**

1. Open **DBeaver**
2. Connect to PostgreSQL `recipe_db`
3. Right-click on connection → **SQL Editor** → **Open SQL Script**
4. Select `migrations/001_create_cleaned_recipes.sql`
5. Click **Execute SQL Statement** (Ctrl+Enter)
6. Repeat for `migrations/002_create_sessions.sql`

---

### **Method 4: Copy & Paste (Manual)**

1. Open any PostgreSQL client (psql, pgAdmin, DBeaver, etc.)
2. Connect to `recipe_db` database
3. Open `migrations/001_create_cleaned_recipes.sql` in a text editor
4. Copy all content
5. Paste into SQL query window
6. Execute
7. Repeat for `migrations/002_create_sessions.sql`

---

## ✅ Verify Migration Success

After running migrations, verify tables were created:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('cleaned_recipes', 'cleaned_steps', 'cooking_sessions', 'session_states');

-- Expected output:
-- cleaned_recipes
-- cleaned_steps
-- cooking_sessions
-- session_states
```

Check table structures:

```sql
-- Cleaned recipes table
\d cleaned_recipes
\d cleaned_steps

-- Sessions table
\d cooking_sessions
\d session_states
```

---

## 🔄 Rollback (if needed)

To remove all new tables:

```sql
DROP TABLE IF EXISTS session_states CASCADE;
DROP TABLE IF EXISTS cooking_sessions CASCADE;
DROP TABLE IF EXISTS cleaned_steps CASCADE;
DROP TABLE IF EXISTS cleaned_recipes CASCADE;
```

**Note**: This will delete all data in these tables!

---

## 📊 Expected Schema

### **cleaned_recipes**
- `id` (SERIAL PRIMARY KEY)
- `recipe_id` (VARCHAR, FK to recipes)
- `planning_result` (JSONB)
- `title`, `opening_remark`, `closing_remark`
- `cleaned_at`, `created_at`, `updated_at`

### **cleaned_steps**
- `id` (SERIAL PRIMARY KEY)
- `cleaned_recipe_id` (FK to cleaned_recipes)
- `step_order`, `script`, `retry_script`, `fallback_script`, `pause_hint`
- `estimated_time_sec`, `timer_required`, `timer_message`

### **cooking_sessions**
- `session_id` (VARCHAR PRIMARY KEY)
- `user_id`, `cleaned_recipe_id` (FK to cleaned_recipes)
- `current_step_index`, `viewing_step_index`
- `status`, `voice_mode`
- `started_at`, `ended_at`, `last_activity_at`

### **session_states**
- `id` (SERIAL PRIMARY KEY)
- `session_id` (FK to cooking_sessions)
- `state_type`, `state_data` (JSONB)
- `created_at`

---

## 🎉 Next Steps

After successful migration:

1. ✅ Verify all tables created
2. ✅ Check indexes created
3. ✅ Proceed to **Phase 2**: RecipeService implementation

---

## ⚠️ Important Notes

- **Do NOT delete** `recipes`, `ingredients`, `steps` tables (Raw Recipe DB)
- New tables are **additions**, not replacements
- Foreign key relationships ensure data consistency
- Indexes are created for performance optimization
- Triggers automatically update `last_activity_at` in sessions

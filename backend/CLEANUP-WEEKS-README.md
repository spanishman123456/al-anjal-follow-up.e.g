# Clean up weeks (1st quarter: 1–9 only; 2nd quarter: 10–18 only)

This one-time script removes any weeks that don’t belong in the correct quarter and deletes their scores.

- **1st quarter (semester 1):** Keeps only weeks with number **1–9**. Deletes all other semester-1 weeks and their scores.
- **2nd quarter (semester 2):** Keeps only weeks with number **10–18**. Deletes all other semester-2 weeks and their scores.

## How to run

1. Open a terminal.
2. Go to the **backend** folder (where `cleanup_weeks.py` and `.env` are):
   ```bash
   cd path\to\Hosam-main\backend
   ```
3. Run:
   ```bash
   python cleanup_weeks.py
   ```
4. The script will print what was deleted and list the remaining weeks.

## Requirements

- `backend/.env` must contain `MONGO_URL` (and optionally `DB_NAME`, default `school_db`).
- Same environment you use for the app (local or the one that connects to your MongoDB Atlas).

## After running

- **1st quarter** will show only weeks 1–9 in the app.
- **2nd quarter** will show only weeks 10–18.
- You can add new weeks from the app (Add Week) if you need more; they will get the correct numbers per quarter.

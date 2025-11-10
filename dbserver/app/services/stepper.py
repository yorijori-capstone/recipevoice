from __future__ import annotations


def next_step(current: int, total_steps: int) -> dict:
    if current is None:
        current = 0
    try:
        cur_no = int(current)
    except Exception:
        cur_no = 0

    if cur_no < 0:
        cur_no = 0

    next_no = cur_no + 1
    if total_steps is not None and next_no > int(total_steps):
        next_no = int(total_steps)
    return {"next_no": next_no}

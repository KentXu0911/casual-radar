#!/usr/bin/env python3
import asyncio
import json
import sys
from pathlib import Path

SKILL_SCRIPTS = Path("/Users/kenny/.codex/skills/databrain-agent/scripts")
sys.path.insert(0, str(SKILL_SCRIPTS))

from query_chat import run_query  # noqa: E402


BATCHES = {
    1: ["Fall Guys", "Eggy Party", "Stumble Guys", "Party Animals", "Faaast Penguin", "Sonic Rumble Party", "Brawl Stars", "Pokémon Unite", "T3 Arena", "SMASH LEGENDS", "Zooba: Zoo Battle Arena", "FRAG Pro Shooter", "Among Us", "Goose Goose Duck", "Super Sus", "Project Winter", "元梦之星"],
    2: ["Clash Royale", "MARVEL SNAP", "Rush Royale", "Random Dice: Defense", "Teamfight Tactics", "Golden Spatula", "Super Auto Pets", "Backpack Battles", "Dread Hunger", "Hearthstone Battlegrounds", "Identity V", "Dead by Daylight", "Tom and Jerry Mobile", "逃跑吧！少年", "DRAGON BALL: THE BREAKERS", "Ghostbusters: Spirits Unleashed Ecto Edition", "First Class Trouble", "LOCKDOWN Protocol"],
    3: ["Dark and Darker", "Lethal Company", "R.E.P.O.", "Content Warning", "Phasmophobia", "超自然行动组", "PEAK", "Escape the Backrooms", "Murky Divers", "Overcooked! 2", "PlateUp!", "Pummel Party", "King Of The Castle", "Dale & Dawson Stationery Supplies", "Stardew Valley", "DAVE THE DIVER", "Slime Rancher", "Potion Craft: Alchemist Simulator"],
    4: ["WePlay", "TopTop", "Pocket Champs: 3D Racing Games", "LEGO Party!", "Ultimate Chicken Horse", "The Jackbox Party Pack", "Squad Busters", "DEATH NOTE Killer Within", "Town of Salem 2", "Lucky Defense", "Dinkum", "Luma Island", "Epic Shaman Battle: 4P Defense", "Plinko Defense", "I Am Sword", "Castle Clashers!", "Cup Heroes", "Bag Fight"],
    5: ["Palworld", "Craftopia", "ARK: Survival Evolved", "Once Human", "Smalland: Survive the Wilds", "Go Go Town", "Animal Crossing: New Horizons", "Heartopia", "Palia", "Disney Dreamlight Valley", "Go-Go Town!", "Cozy Grove", "Sun Haven", "Coral Island", "My Time at Sandrock", "Just Dance Party"],
    6: ["Faaast Penguin", "LEGO Party!", "Potion Permit", "Dread Hunger", "Dark and Darker", "Go-Go Town!", "Hearthstone Battlegrounds"],
    7: ["Town of Salem 2", "Content Warning", "Animal Crossing: New Horizons", "Tom and Jerry Mobile", "舞力全开：派对 Just Dance Party", "逃跑吧！少年"],
}


async def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: fetch-databrain-trend-batch.py BATCH OUTPUT_JSON")
    batch = int(sys.argv[1])
    output = Path(sys.argv[2])
    games = BATCHES[batch]
    query = (
        "只查询下列游戏，返回 2026-05-25 至 2026-09-09 的日频原始 bi_data："
        + "、".join(games)
        + "。移动端需要 daily DAU 和 daily revenue；PC/Steam 需要 daily Alinea ACU、PCU 和 daily estimated revenue。"
        "每行必须保留 game_name、game_type、date、granularity、metric、platform、region_name/market_name、source 及指标值。"
        "不要插值，不要将 DAU 当作 ACU，不要用月收入或累计收入代替日收入。"
    )
    events = []
    session_id = ""
    async for event in run_query(query):
        events.append(event)
        if not session_id:
            session_id = str(event.get("id") or "")
        if "error" in event:
            raise RuntimeError(json.dumps(event["error"], ensure_ascii=False))
    payload = {
        "sessionId": session_id,
        "system_url": f"https://databrain.woa.com/v2/agent/chat?sessionId={session_id}",
        "events": events,
    }
    output.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"batch": batch, "sessionId": session_id, "events": len(events), "output": str(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

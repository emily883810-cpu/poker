"""Validate the persisted JSON boundary, not a poker legality or strategy solver."""
import math
import re

STREETS = ['Preflop', 'Flop', 'Turn', 'River']


def validate_hand(h):
    def require(ok, message):
        if not ok:
            raise ValueError(message)

    def number(n):
        return isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n) and n >= 0

    require(isinstance(h, dict) and h.get('completed') is True, '只接受已完成手牌')
    require(isinstance(h.get('id'), str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,100}', h['id']), 'Hand ID 格式錯誤')
    for field in ('title', 'site', 'stakes', 'currency'):
        require(isinstance(h.get(field), str) and len(h[field]) <= 500, field + ' 格式錯誤')
    require(h.get('maxSeats') in (6, 9), '只支援 6-max / 9-max')
    require(type(h.get('dealer')) is int and 1 <= h['dealer'] <= h['maxSeats'], 'Button 座號不正確')
    ps, actions, board = h.get('players'), h.get('actions'), h.get('board')
    require(isinstance(ps, list) and 2 <= len(ps) <= h['maxSeats'], '座位數錯誤')
    require(isinstance(board, list) and len(board) in (0, 3, 4, 5), 'Board 格式錯誤')
    names, seats, cards, balances, invested = set(), set(), list(board), {}, {}
    for p in ps:
        require(isinstance(p, dict), 'Player 格式錯誤')
        name, seat = p.get('name'), p.get('seat')
        require(isinstance(name, str) and 0 < len(name) <= 100 and name not in names, '玩家名稱重複或錯誤')
        require(type(seat) is int and 1 <= seat <= h['maxSeats'] and seat not in seats, '座號錯誤')
        require(number(p.get('stack')) and p['stack'] > 0, 'Stack 錯誤')
        require(isinstance(p.get('position', ''), str), 'Position 格式錯誤')
        hole = p.get('cards', [])
        require(isinstance(hole, list) and len(hole) in (0, 2), '底牌格式錯誤')
        cards.extend(hole)
        names.add(name)
        seats.add(seat)
        balances[name], invested[name] = p['stack'], 0
    require(all(isinstance(c, str) and re.fullmatch('[2-9TJQKA][cdhs?]', c) for c in cards), '牌面錯誤')
    known = [c for c in cards if c[1] != '?']
    require(len(set(known)) == len(known) and all(sum(c[0] == rank for c in cards) <= 4 for rank in '23456789TJQKA'), '有重複牌或同點數超過四張')
    require(isinstance(actions, list) and 0 < len(actions) <= 1000, 'Actions 格式錯誤')
    street, pot, collected, folded = 0, 0, False, set()
    for a in actions:
        require(isinstance(a, dict) and a.get('street') in STREETS and (a.get('type') == 'deal' or a.get('player') in names), 'Action 街或玩家錯誤')
        idx = STREETS.index(a['street'])
        require(idx >= street and (idx == 0 or len(board) >= idx + 2), '街序或公共牌不完整')
        if idx != street:
            invested = dict.fromkeys(names, 0)
        street = idx
        kind, name, amount = a.get('type'), a.get('player'), a.get('amount')
        if kind == 'deal':
            require(amount == 0, '發牌事件金額應為 0')
            continue
        require(kind in ('post', 'bet', 'call', 'raise', 'return', 'collect', 'fold', 'check') and number(amount), '動作或金額錯誤')
        if kind in ('post', 'bet', 'call', 'raise'):
            require(name not in folded and amount <= balances[name] + 0.001, '下注超過 Stack 或已棄牌')
            balances[name] -= amount
            invested[name] += amount
            pot += amount
        elif kind == 'return':
            require(amount <= invested[name] + 0.001, '退回額超過當街投入')
            balances[name] += amount
            invested[name] -= amount
            pot -= amount
        elif kind == 'collect':
            require(amount <= pot + 0.001, '派彩超過底池')
            balances[name] += amount
            pot -= amount
            collected = True
        else:
            require(amount == 0, 'Check/Fold 金額應為 0')
            if kind == 'fold':
                folded.add(name)
    require(collected or h.get('settlement') == 'unrecorded', '必須記錄 collect 派彩或明確標記未記派彩')
    require(isinstance(h.get('tags'), list) and all(isinstance(t, str) and len(t) <= 100 for t in h['tags']), 'Tags 格式錯誤')
    require(isinstance(h.get('notes', ''), str), 'Notes 格式錯誤')
    return h

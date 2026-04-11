INSERT INTO event_quests (event_id, quest_type, target_amount, reward_type, reward_amount, title, sort_order)
SELECT id, 'win_bot', 1, 'event_currency', 50, 'Выиграть 1 игру с ботами', 5 FROM events WHERE key = 'spring_2026';

INSERT INTO event_quests (event_id, quest_type, target_amount, reward_type, reward_amount, title, sort_order)
SELECT id, 'win_bot', 3, 'event_currency', 100, 'Выиграть 3 игры с ботами', 6 FROM events WHERE key = 'spring_2026';

INSERT INTO event_quests (event_id, quest_type, target_amount, reward_type, reward_amount, title, sort_order)
SELECT id, 'win_ranked', 5, 'event_currency', 150, 'Выиграть 5 рейтинговых игр', 7 FROM events WHERE key = 'spring_2026';

INSERT INTO event_quests (event_id, quest_type, target_amount, reward_type, reward_amount, title, sort_order)
SELECT id, 'win_ranked', 10, 'event_currency', 300, 'Выиграть 10 рейтинговых игр', 8 FROM events WHERE key = 'spring_2026';

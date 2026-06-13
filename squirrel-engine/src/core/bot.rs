use crate::utils::schemas::{BotDifficulty, Card, GameState, PlayerPosition, Rank};
use rand::seq::SliceRandom;

fn is_teammate(p1: PlayerPosition, p2: PlayerPosition) -> bool {
    matches!(
        (p1, p2),
        (PlayerPosition::North, PlayerPosition::South)
            | (PlayerPosition::South, PlayerPosition::North)
            | (PlayerPosition::East, PlayerPosition::West)
            | (PlayerPosition::West, PlayerPosition::East)
            | (PlayerPosition::North, PlayerPosition::North)
            | (PlayerPosition::South, PlayerPosition::South)
            | (PlayerPosition::East, PlayerPosition::East)
            | (PlayerPosition::West, PlayerPosition::West)
    )
}

pub fn determine_bot_move(
    state: &GameState,
    player: PlayerPosition,
    difficulty: BotDifficulty,
) -> Card {
    let hand = state.hands.get(&player).expect("Bot hand not found");
    if hand.is_empty() {
        panic!("Bot has no cards to play");
    }

    let mut valid_cards = get_valid_cards(state, player, hand);
    if valid_cards.is_empty() {
        tracing::error!("Bot logic bug: get_valid_cards returned empty! Falling back to full hand to prevent crash. Hand: {:?}, Trick: {:?}", hand, state.current_trick);
        valid_cards = hand.clone();
    }

    match difficulty {
        BotDifficulty::Medium | BotDifficulty::Tutorial => {
            // Pick a random valid card
            let mut rng = rand::thread_rng();
            *valid_cards
                .choose(&mut rng)
                .expect("No valid cards found for bot")
        }
        BotDifficulty::Hard => {
            // Basic Hard logic:
            // If we are leading the trick, try to play a high value card if we have strong trumps, or throw junk.
            // If not leading, try to win the trick with minimal power necessary.
            // If we can't win, throw the lowest power card.

            if state.current_trick.is_empty() {
                // Leading: just play the highest power card we have for now with a slight preference
                // Wait, playing highest is not always good, but simple enough for 'Hard' card trick logic.
                // Let's actually play the highest power card in our hand based on trump.
                let trump = state.trump;
                valid_cards
                    .into_iter()
                    .max_by_key(|c| c.power(c.suit, trump))
                    .unwrap()
            } else {
                let lead_card = state.current_trick[0].1;
                let trump = state.trump;

                // Find the current winning card and its power
                let current_winner_pos = state
                    .current_trick
                    .iter()
                    .max_by_key(|(_, c)| c.power(lead_card.suit, trump))
                    .unwrap()
                    .0;
                let current_winner_card = state
                    .current_trick
                    .iter()
                    .max_by_key(|(_, c)| c.power(lead_card.suit, trump))
                    .unwrap()
                    .1;
                let winning_power = current_winner_card.power(lead_card.suit, trump);

                let teammate_is_winning = is_teammate(player, current_winner_pos);

                if teammate_is_winning {
                    let forced_to_win = valid_cards
                        .iter()
                        .all(|c| c.power(lead_card.suit, trump) > winning_power);
                    if forced_to_win {
                        let mut winning_cards = valid_cards;
                        winning_cards.sort_by_key(|c| c.power(lead_card.suit, trump));
                        winning_cards[0]
                    } else {
                        let mut losing_cards: Vec<Card> = valid_cards
                            .into_iter()
                            .filter(|c| c.power(lead_card.suit, trump) <= winning_power)
                            .collect();
                        if state.current_trick.len() == 3 {
                            // Last player, give max points!
                            losing_cards.sort_by_key(|c| c.points());
                            losing_cards.last().copied().unwrap()
                        } else {
                            // Not last, minimize risk
                            losing_cards
                                .sort_by_key(|c| (c.power(lead_card.suit, trump), c.points()));
                            losing_cards[0]
                        }
                    }
                } else {
                    // Opponent is winning
                    let mut winning_cards: Vec<Card> = valid_cards
                        .iter()
                        .filter(|c| c.power(lead_card.suit, trump) > winning_power)
                        .copied()
                        .collect();

                    if !winning_cards.is_empty() {
                        // Play the valid winning card with the lowest power (don't overspend)
                        winning_cards.sort_by_key(|c| c.power(lead_card.suit, trump));
                        winning_cards[0]
                    } else {
                        // Cannot win trick, throw cheapest card
                        let mut losing_cards = valid_cards;
                        losing_cards.sort_by_key(|c| (c.power(lead_card.suit, trump), c.points()));
                        losing_cards[0]
                    }
                }
            }
        }
    }
}

pub fn get_valid_cards(state: &GameState, player: PlayerPosition, hand: &Vec<Card>) -> Vec<Card> {
    if state.current_trick.is_empty() {
        // Can lead with anything, except Ace restriction if suits not played
        return hand
            .iter()
            .filter(|&&card| {
                if card.rank == Rank::Ace && !state.suits_played.contains(&card.suit) {
                    // Cannot play Ace if suit hasn't been played and we have an alternative
                    let has_alternative = hand.iter().any(|c| {
                        if *c == card {
                            return false;
                        }
                        !(c.rank == Rank::Ace && !state.suits_played.contains(&c.suit))
                    });
                    !has_alternative
                } else {
                    true
                }
            })
            .copied()
            .collect();
    }

    let lead_card = state.current_trick[0].1;
    let effective_lead_suit = if lead_card.rank == Rank::Jack {
        state.trump
    } else {
        lead_card.suit
    };

    let has_effective_lead_suit = hand.iter().any(|c| {
        if effective_lead_suit == state.trump {
            c.suit == state.trump || c.rank == Rank::Jack
        } else {
            c.rank != Rank::Jack && c.suit == effective_lead_suit
        }
    });

    hand.iter()
        .filter(|&&card| {
            let played_matches_effective_lead = if effective_lead_suit == state.trump {
                card.suit == state.trump || card.rank == Rank::Jack
            } else {
                card.rank != Rank::Jack && card.suit == effective_lead_suit
            };

            if has_effective_lead_suit && !played_matches_effective_lead {
                return false;
            }

            if card.rank == Rank::Ace && !state.suits_played.contains(&card.suit) {
                let has_alternative = hand.iter().any(|c| {
                    if *c == card {
                        return false;
                    }
                    let matches_effective = if effective_lead_suit == state.trump {
                        c.suit == state.trump || c.rank == Rank::Jack
                    } else {
                        c.rank != Rank::Jack && c.suit == effective_lead_suit
                    };
                    if has_effective_lead_suit && !matches_effective {
                        return false;
                    }
                    !(c.rank == Rank::Ace && !state.suits_played.contains(&c.suit))
                });
                if has_alternative {
                    return false;
                }
            }

            true
        })
        .copied()
        .collect()
}

pub fn analyze_and_hint(state: &GameState, player: PlayerPosition) -> (Option<Card>, String) {
    let hand = state.hands.get(&player).expect("Bot hand not found");
    if hand.is_empty() {
        return (None, "Ожидайте хода...".to_string());
    }

    let mut valid_cards = get_valid_cards(state, player, hand);
    if valid_cards.is_empty() {
        valid_cards = hand.clone();
    }

    if state.current_trick.is_empty() {
        let trump = state.trump;
        let best_card = valid_cards
            .into_iter()
            .max_by_key(|c| c.power(c.suit, trump))
            .unwrap();
        let reason = if best_card.rank == Rank::Jack {
            "Вы ходите первым. Выгодно зайти с козырного Вальта, чтобы выбить козыри противников и гарантированно начать взятку.".to_string()
        } else if best_card.suit == trump {
            "Вы ходите первым. Пойдем с козыря, чтобы заставить оппонентов сбросить свои сильные карты.".to_string()
        } else {
            "Заходим с сильной карты, чтобы попытаться забрать первую взятку без использования козырей.".to_string()
        };
        (Some(best_card), reason)
    } else {
        let lead_card = state.current_trick[0].1;
        let trump = state.trump;
        let current_winner_pos = state
            .current_trick
            .iter()
            .max_by_key(|(_, c)| c.power(lead_card.suit, trump))
            .unwrap()
            .0;
        let current_winner_card = state
            .current_trick
            .iter()
            .max_by_key(|(_, c)| c.power(lead_card.suit, trump))
            .unwrap()
            .1;
        let winning_power = current_winner_card.power(lead_card.suit, trump);

        let teammate_is_winning = is_teammate(player, current_winner_pos);

        if teammate_is_winning {
            let forced_to_win = valid_cards
                .iter()
                .all(|c| c.power(lead_card.suit, trump) > winning_power);
            if forced_to_win {
                let mut winning_cards = valid_cards;
                winning_cards.sort_by_key(|c| c.power(lead_card.suit, trump));
                let best_card = winning_cards[0];
                let reason = "Эту взятку и так забирает наш напарник, но правила заставляют нас перебить его. Скидываем самую слабую из подходящих карт.".to_string();
                (Some(best_card), reason)
            } else {
                let mut losing_cards: Vec<Card> = valid_cards
                    .into_iter()
                    .filter(|c| c.power(lead_card.suit, trump) <= winning_power)
                    .collect();
                if state.current_trick.len() == 3 {
                    losing_cards.sort_by_key(|c| c.points());
                    let best_card = *losing_cards.last().unwrap();
                    let reason = "Взятку гарантированно забирает наш напарник! «Мажемся» — скидываем самую «жирную» по очкам карту, чтобы принести команде максимум очков.".to_string();
                    (Some(best_card), reason)
                } else {
                    losing_cards.sort_by_key(|c| (c.power(lead_card.suit, trump), c.points()));
                    let best_card = losing_cards[0];
                    let reason = "Напарник пока побеждает во взятке, но после нас еще ходят оппоненты. На всякий случай скидываем слабую карту (не рискуем очками).".to_string();
                    (Some(best_card), reason)
                }
            }
        } else {
            let mut winning_cards: Vec<Card> = valid_cards
                .iter()
                .filter(|c| c.power(lead_card.suit, trump) > winning_power)
                .copied()
                .collect();

            if !winning_cards.is_empty() {
                winning_cards.sort_by_key(|c| c.power(lead_card.suit, trump));
                let best_card = winning_cards[0];
                let reason = if best_card.rank == Rank::Jack || best_card.suit == trump {
                    "Эту взятку перебить можно только козырем! Кладем его, чтобы забрать очки."
                        .to_string()
                } else {
                    "У нас есть подходящая карта, чтобы забрать взятку! Используем её экономно."
                        .to_string()
                };
                (Some(best_card), reason)
            } else {
                let mut losing_cards = valid_cards;
                losing_cards.sort_by_key(|c| (c.power(lead_card.suit, trump), c.points()));
                let best_card = losing_cards[0];
                let reason = "Мы никак не можем выиграть эту взятку. Скидываем самую слабую и ненужную карту, чтобы минимизировать потери.".to_string();
                (Some(best_card), reason)
            }
        }
    }
}

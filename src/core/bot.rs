use rand::seq::SliceRandom;
use crate::utils::schemas::{BotDifficulty, Card, GameState, PlayerPosition, Rank, Suit};

pub fn determine_bot_move(state: &GameState, player: PlayerPosition, difficulty: BotDifficulty) -> Card {
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
        BotDifficulty::Medium => {
            // Pick a random valid card
            let mut rng = rand::thread_rng();
            *valid_cards.choose(&mut rng).expect("No valid cards found for bot")
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
                valid_cards.into_iter().max_by_key(|c| c.power(c.suit, trump)).unwrap()
            } else {
                let lead_card = state.current_trick[0].1;
                let trump = state.trump;
                
                // Find the current winning card and its power
                let current_winner = state.current_trick.iter().max_by_key(|(_, c)| c.power(lead_card.suit, trump)).unwrap().1;
                let winning_power = current_winner.power(lead_card.suit, trump);

                // Find cards that can beat the current winning card
                let mut winning_cards: Vec<Card> = valid_cards.iter().filter(|c| c.power(lead_card.suit, trump) > winning_power).copied().collect();

                if !winning_cards.is_empty() {
                    // Play the valid winning card with the lowest power (don't overspend)
                    winning_cards.sort_by_key(|c| c.power(lead_card.suit, trump));
                    winning_cards[0]
                } else {
                    // Cannot win trick, throw cheapest card
                    let mut losing_cards = valid_cards;
                    losing_cards.sort_by_key(|c| c.power(lead_card.suit, trump));
                    losing_cards[0]
                }
            }
        }
    }
}

fn get_valid_cards(state: &GameState, player: PlayerPosition, hand: &Vec<Card>) -> Vec<Card> {
    if state.current_trick.is_empty() {
        // Can lead with anything, except Ace restriction if suits not played
        return hand.iter().filter(|&&card| {
            if card.rank == Rank::Ace && !state.suits_played.contains(&card.suit) {
                // Cannot play Ace if suit hasn't been played and we have an alternative
                let has_alternative = hand.iter().any(|c| {
                    if *c == card { return false; }
                    !(c.rank == Rank::Ace && !state.suits_played.contains(&c.suit))
                });
                !has_alternative
            } else {
                true
            }
        }).copied().collect();
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

    hand.iter().filter(|&&card| {
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
                if *c == card { return false; }
                let matches_effective = if effective_lead_suit == state.trump {
                    c.suit == state.trump || c.rank == Rank::Jack
                } else {
                    c.rank != Rank::Jack && c.suit == effective_lead_suit
                };
                if has_effective_lead_suit && !matches_effective { return false; }
                !(c.rank == Rank::Ace && !state.suits_played.contains(&c.suit))
            });
            if has_alternative { return false; }
        }

        true
    }).copied().collect()
}

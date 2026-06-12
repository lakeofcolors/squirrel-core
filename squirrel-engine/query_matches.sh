#!/bin/bash
cargo sqlx query "SELECT id, jsonb_array_length(replay_events) as events_len FROM matches ORDER BY id DESC LIMIT 5"

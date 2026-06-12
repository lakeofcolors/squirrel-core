# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class SqlxMigrations(models.Model):
    version = models.BigIntegerField(primary_key=True)
    description = models.TextField()
    installed_on = models.DateTimeField()
    success = models.BooleanField()
    checksum = models.BinaryField()
    execution_time = models.BigIntegerField()

    class Meta:
        managed = False
        db_table = '_sqlx_migrations'


class Achievements(models.Model):
    key = models.TextField(primary_key=True)
    title = models.TextField()
    description = models.TextField()
    icon_url = models.TextField()
    sort_order = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'achievements'


class AuthGroup(models.Model):
    name = models.CharField(unique=True, max_length=150)

    class Meta:
        managed = False
        db_table = 'auth_group'


class AuthGroupPermissions(models.Model):
    id = models.BigAutoField(primary_key=True)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)
    permission = models.ForeignKey('AuthPermission', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'auth_group_permissions'
        unique_together = (('group', 'permission'),)


class AuthPermission(models.Model):
    name = models.CharField(max_length=255)
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING)
    codename = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'auth_permission'
        unique_together = (('content_type', 'codename'),)


class AuthUser(models.Model):
    password = models.CharField(max_length=128)
    last_login = models.DateTimeField(blank=True, null=True)
    is_superuser = models.BooleanField()
    username = models.CharField(unique=True, max_length=150)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.CharField(max_length=254)
    is_staff = models.BooleanField()
    is_active = models.BooleanField()
    date_joined = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'auth_user'


class AuthUserGroups(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(AuthUser, models.DO_NOTHING)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'auth_user_groups'
        unique_together = (('user', 'group'),)


class AuthUserUserPermissions(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(AuthUser, models.DO_NOTHING)
    permission = models.ForeignKey(AuthPermission, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'auth_user_user_permissions'
        unique_together = (('user', 'permission'),)


class ClanMembers(models.Model):
    clan = models.OneToOneField('Clans', models.DO_NOTHING, primary_key=True)  # The composite primary key (clan_id, telegram_id) found, that is not supported. The first column is selected.
    telegram = models.OneToOneField('Users', models.DO_NOTHING)
    role = models.TextField()
    joined_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'clan_members'
        unique_together = (('clan', 'telegram'),)


class Clans(models.Model):
    name = models.TextField(unique=True)
    tag = models.TextField(unique=True)
    owner = models.ForeignKey('Users', models.DO_NOTHING, blank=True, null=True)
    rating = models.IntegerField()
    trophies = models.IntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'clans'


class DjangoAdminLog(models.Model):
    action_time = models.DateTimeField()
    object_id = models.TextField(blank=True, null=True)
    object_repr = models.CharField(max_length=200)
    action_flag = models.SmallIntegerField()
    change_message = models.TextField()
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey(AuthUser, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'django_admin_log'


class DjangoContentType(models.Model):
    app_label = models.CharField(max_length=100)
    model = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'django_content_type'
        unique_together = (('app_label', 'model'),)


class DjangoMigrations(models.Model):
    id = models.BigAutoField(primary_key=True)
    app = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    applied = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_migrations'


class DjangoSession(models.Model):
    session_key = models.CharField(primary_key=True, max_length=40)
    session_data = models.TextField()
    expire_date = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_session'


class EventQuests(models.Model):
    event = models.ForeignKey('Events', models.DO_NOTHING)
    quest_type = models.TextField()
    target_amount = models.IntegerField()
    reward_type = models.TextField()
    reward_amount = models.IntegerField()
    reward_item_id = models.TextField(blank=True, null=True)
    title = models.TextField()
    sort_order = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'event_quests'


class EventShopItems(models.Model):
    event = models.ForeignKey('Events', models.DO_NOTHING)
    item_type = models.TextField()
    item_id = models.TextField()
    cost = models.IntegerField()
    title = models.TextField()
    icon = models.TextField()
    sort_order = models.IntegerField(blank=True, null=True)
    max_purchases = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'event_shop_items'


class Events(models.Model):
    key = models.TextField(unique=True)
    title = models.TextField()
    description = models.TextField()
    currency_icon = models.TextField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'events'


class FriendRequests(models.Model):
    id = models.BigAutoField(primary_key=True)
    from_telegram = models.ForeignKey('Users', models.DO_NOTHING)
    to_telegram = models.ForeignKey('Users', models.DO_NOTHING, related_name='friendrequests_to_telegram_set')
    status = models.TextField()
    created_at = models.DateTimeField()
    responded_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'friend_requests'
        unique_together = (('from_telegram', 'to_telegram'),)


class GameInvites(models.Model):
    id = models.BigAutoField(primary_key=True)
    from_telegram = models.ForeignKey('Users', models.DO_NOTHING)
    to_telegram = models.ForeignKey('Users', models.DO_NOTHING, related_name='gameinvites_to_telegram_set')
    room_id = models.TextField(blank=True, null=True)
    status = models.TextField()
    created_at = models.DateTimeField()
    responded_at = models.DateTimeField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'game_invites'


class GhostBots(models.Model):
    telegram = models.OneToOneField('Users', models.DO_NOTHING, primary_key=True)
    is_active = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'ghost_bots'


class GlobalState(models.Model):
    key = models.TextField(primary_key=True)
    value = models.BigIntegerField()

    class Meta:
        managed = False
        db_table = 'global_state'


class LuckySpinRewards(models.Model):
    name = models.CharField(max_length=255)
    reward_type = models.CharField(max_length=50)
    item_id = models.CharField(max_length=255, blank=True, null=True)
    amount = models.IntegerField()
    weight = models.IntegerField()
    hex_color = models.CharField(max_length=10)
    icon_emoji = models.CharField(max_length=10)

    class Meta:
        managed = False
        db_table = 'lucky_spin_rewards'


class MatchHistory(models.Model):
    id = models.BigAutoField(primary_key=True)
    match = models.ForeignKey('Matches', models.DO_NOTHING)
    telegram = models.ForeignKey('Users', models.DO_NOTHING)
    room_id = models.TextField(blank=True, null=True)
    mode = models.TextField()
    result = models.TextField()
    score = models.TextField(blank=True, null=True)
    rating_delta = models.IntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'match_history'
        unique_together = (('match', 'telegram'),)


class MatchPlayers(models.Model):
    id = models.BigAutoField(primary_key=True)
    match = models.ForeignKey('Matches', models.DO_NOTHING)
    telegram = models.ForeignKey('Users', models.DO_NOTHING)
    team = models.TextField(blank=True, null=True)
    seat = models.IntegerField(blank=True, null=True)
    result = models.TextField()
    rating_before = models.IntegerField()
    rating_after = models.IntegerField()
    rating_delta = models.IntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'match_players'
        unique_together = (('match', 'telegram'),)


class Matches(models.Model):
    id = models.BigAutoField(primary_key=True)
    room_id = models.TextField(blank=True, null=True)
    mode = models.TextField()
    is_ranked = models.BooleanField()
    stake = models.BigIntegerField()
    status = models.TextField()
    end_reason = models.TextField(blank=True, null=True)
    winner_team = models.TextField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    replay_events = models.JSONField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'matches'


class RewardedSessions(models.Model):
    id = models.TextField(primary_key=True)
    telegram = models.ForeignKey('Users', models.DO_NOTHING)
    reward_type = models.TextField()
    reward_amount = models.BigIntegerField()
    ad_provider = models.TextField(blank=True, null=True)
    status = models.TextField()
    provider_event_id = models.TextField(unique=True, blank=True, null=True)
    custom_data = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'rewarded_sessions'


class StoreCosmetics(models.Model):
    id = models.TextField(primary_key=True)
    item_type = models.TextField()
    item_key = models.TextField()
    title = models.TextField()
    description = models.TextField(blank=True, null=True)
    price_nuts = models.BigIntegerField()
    rarity = models.TextField()
    is_active = models.BooleanField()
    sort_order = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'store_cosmetics'
        unique_together = (('item_type', 'item_key'),)


class StoreNutsPacks(models.Model):
    id = models.TextField(primary_key=True)
    title = models.TextField()
    description = models.TextField(blank=True, null=True)
    xtr_amount = models.BigIntegerField()
    nuts_amount = models.BigIntegerField()
    bonus_nuts_amount = models.BigIntegerField()
    is_featured = models.BooleanField(unique=True)
    is_active = models.BooleanField()
    sort_order = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'store_nuts_packs'


class StoreOrders(models.Model):
    id = models.TextField(primary_key=True)
    telegram = models.ForeignKey('Users', models.DO_NOTHING)
    product_id = models.TextField()
    nuts_amount = models.BigIntegerField()
    xtr_amount = models.BigIntegerField()
    status = models.TextField()
    telegram_payment_charge_id = models.TextField(blank=True, null=True)
    provider_payment_charge_id = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    paid_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'store_orders'


class TournamentMatches(models.Model):
    tournament = models.ForeignKey('Tournaments', models.DO_NOTHING, blank=True, null=True)
    round = models.IntegerField()
    match_index = models.IntegerField()
    clan1 = models.ForeignKey(Clans, models.DO_NOTHING, blank=True, null=True)
    clan2 = models.ForeignKey(Clans, models.DO_NOTHING, related_name='tournamentmatches_clan2_set', blank=True, null=True)
    winner = models.ForeignKey(Clans, models.DO_NOTHING, related_name='tournamentmatches_winner_set', blank=True, null=True)
    room_id = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'tournament_matches'
        unique_together = (('tournament', 'round', 'match_index'),)


class TournamentRegistrations(models.Model):
    tournament = models.ForeignKey('Tournaments', models.DO_NOTHING, blank=True, null=True)
    clan = models.ForeignKey(Clans, models.DO_NOTHING, blank=True, null=True)
    registered_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'tournament_registrations'
        unique_together = (('tournament', 'clan'),)


class TournamentSquads(models.Model):
    registration = models.ForeignKey(TournamentRegistrations, models.DO_NOTHING, blank=True, null=True)
    telegram = models.ForeignKey('Users', models.DO_NOTHING, blank=True, null=True)
    is_substitute = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'tournament_squads'
        unique_together = (('registration', 'telegram'),)


class Tournaments(models.Model):
    title = models.TextField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.TextField()

    class Meta:
        managed = False
        db_table = 'tournaments'


class UserAchievements(models.Model):
    telegram = models.OneToOneField('Users', models.DO_NOTHING, primary_key=True)  # The composite primary key (telegram_id, achievement_key) found, that is not supported. The first column is selected.
    achievement_key = models.ForeignKey(Achievements, models.DO_NOTHING, db_column='achievement_key')
    unlocked_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user_achievements'
        unique_together = (('telegram', 'achievement_key'),)


class UserBoosters(models.Model):
    telegram = models.OneToOneField('Users', models.DO_NOTHING, primary_key=True)  # The composite primary key (telegram_id, booster_id) found, that is not supported. The first column is selected.
    booster_id = models.TextField()
    amount = models.IntegerField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user_boosters'
        unique_together = (('telegram', 'booster_id'),)


class UserChests(models.Model):
    id = models.BigAutoField(primary_key=True)
    telegram = models.ForeignKey('Users', models.DO_NOTHING)
    chest_type = models.TextField()
    amount = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user_chests'
        unique_together = (('telegram', 'chest_type'),)


class UserEquippedItems(models.Model):
    telegram = models.OneToOneField('Users', models.DO_NOTHING, primary_key=True)
    equipped_deck_id = models.TextField(blank=True, null=True)
    equipped_background_id = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user_equipped_items'


class UserEventCurrency(models.Model):
    telegram = models.OneToOneField('Users', models.DO_NOTHING, primary_key=True)  # The composite primary key (telegram_id, event_id) found, that is not supported. The first column is selected.
    event = models.ForeignKey(Events, models.DO_NOTHING)
    amount = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'user_event_currency'
        unique_together = (('telegram', 'event'),)


class UserEventPurchases(models.Model):
    telegram = models.OneToOneField('Users', models.DO_NOTHING, primary_key=True)  # The composite primary key (telegram_id, shop_item_id) found, that is not supported. The first column is selected.
    shop_item = models.ForeignKey(EventShopItems, models.DO_NOTHING)
    purchase_count = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'user_event_purchases'
        unique_together = (('telegram', 'shop_item'),)


class UserFriends(models.Model):
    id = models.BigAutoField(primary_key=True)
    user_telegram = models.ForeignKey('Users', models.DO_NOTHING)
    friend_telegram = models.ForeignKey('Users', models.DO_NOTHING, related_name='userfriends_friend_telegram_set')
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user_friends'
        unique_together = (('user_telegram', 'friend_telegram'),)


class UserInventory(models.Model):
    id = models.BigAutoField(primary_key=True)
    telegram = models.ForeignKey('Users', models.DO_NOTHING)
    item_type = models.TextField()
    item_id = models.TextField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user_inventory'
        unique_together = (('telegram', 'item_type', 'item_id'),)


class UserLuckySpins(models.Model):
    telegram = models.OneToOneField('Users', models.DO_NOTHING, primary_key=True)
    last_free_spin_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'user_lucky_spins'


class UserQuestProgress(models.Model):
    telegram = models.OneToOneField('Users', models.DO_NOTHING, primary_key=True)  # The composite primary key (telegram_id, quest_id) found, that is not supported. The first column is selected.
    quest = models.ForeignKey(EventQuests, models.DO_NOTHING)
    current_amount = models.IntegerField()
    is_completed = models.BooleanField()
    is_claimed = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'user_quest_progress'
        unique_together = (('telegram', 'quest'),)


class UserRewards(models.Model):
    id = models.BigAutoField(primary_key=True)
    telegram = models.ForeignKey('Users', models.DO_NOTHING)
    reward_key = models.TextField()
    title = models.TextField()
    icon = models.TextField()
    rarity = models.TextField()
    unlocked_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user_rewards'
        unique_together = (('telegram', 'reward_key'),)


class Users(models.Model):
    telegram_id = models.BigIntegerField(primary_key=True)
    username = models.TextField(blank=True, null=True)
    rating = models.IntegerField()
    free_coins = models.IntegerField()
    ton_balance = models.BigIntegerField()
    photo_url = models.TextField(blank=True, null=True)
    last_daily_claim = models.DateTimeField(blank=True, null=True)
    daily_streak = models.IntegerField()
    xp = models.IntegerField()
    xp_booster_ends_at = models.DateTimeField(blank=True, null=True)
    nuts_booster_ends_at = models.DateTimeField(blank=True, null=True)
    tournament_coins = models.IntegerField()
    slots_free_spins = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'users'


class WalletTransactions(models.Model):
    id = models.BigAutoField(primary_key=True)
    telegram = models.ForeignKey(Users, models.DO_NOTHING)
    amount = models.BigIntegerField()
    currency = models.TextField()
    tx_type = models.TextField()
    metadata = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'wallet_transactions'

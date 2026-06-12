from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import (
    Users, Events, EventShopItems, EventQuests,
    StoreCosmetics, StoreNutsPacks, StoreOrders,
    UserInventory, UserBoosters, UserChests,
    UserEventCurrency, MatchHistory, GhostBots,
    FriendRequests, GameInvites, Matches, MatchPlayers,
    RewardedSessions, UserEquippedItems, UserFriends,
    UserQuestProgress, UserRewards, WalletTransactions,
    SqlxMigrations, Clans, ClanMembers, Tournaments,
    TournamentRegistrations, TournamentSquads, TournamentMatches
)

@admin.register(Users)
class UsersAdmin(ModelAdmin):
    list_display = ("telegram_id", "username", "rating", "free_coins", "tournament_coins", "slots_free_spins", "ton_balance", "xp")
    search_fields = ("telegram_id", "username")
    list_filter = ("daily_streak",)

@admin.register(Events)
class EventsAdmin(ModelAdmin):
    list_display = ("key", "title", "is_active", "start_time", "end_time")
    list_filter = ("is_active",)
    search_fields = ("key", "title")

@admin.register(EventShopItems)
class EventShopItemsAdmin(ModelAdmin):
    list_display = ("id", "event", "item_type", "item_id", "title", "cost", "max_purchases")
    list_filter = ("event", "item_type")
    search_fields = ("title", "item_id")

@admin.register(EventQuests)
class EventQuestsAdmin(ModelAdmin):
    list_display = ("id", "event", "quest_type", "title", "target_amount", "reward_type", "reward_amount")
    list_filter = ("event", "quest_type", "reward_type")
    search_fields = ("title",)

@admin.register(StoreCosmetics)
class StoreCosmeticsAdmin(ModelAdmin):
    list_display = ("id", "item_type", "item_key", "title", "price_nuts", "rarity", "is_active")
    list_filter = ("item_type", "rarity", "is_active")
    search_fields = ("title", "item_key")

@admin.register(StoreNutsPacks)
class StoreNutsPacksAdmin(ModelAdmin):
    list_display = ("id", "title", "nuts_amount", "xtr_amount", "is_featured", "is_active")
    list_filter = ("is_active", "is_featured")

@admin.register(StoreOrders)
class StoreOrdersAdmin(ModelAdmin):
    list_display = ("id", "telegram", "product_id", "status", "nuts_amount", "xtr_amount", "created_at")
    list_filter = ("status",)
    search_fields = ("id", "product_id")

@admin.register(UserInventory)
class UserInventoryAdmin(ModelAdmin):
    list_display = ("id", "telegram", "item_type", "item_id", "created_at")
    list_filter = ("item_type",)
    search_fields = ("telegram__telegram_id", "item_id")

@admin.register(UserBoosters)
class UserBoostersAdmin(ModelAdmin):
    list_display = ("telegram", "booster_id", "amount", "updated_at")
    search_fields = ("telegram__telegram_id", "booster_id")

@admin.register(UserChests)
class UserChestsAdmin(ModelAdmin):
    list_display = ("id", "telegram", "chest_type", "amount", "updated_at")
    search_fields = ("telegram__telegram_id", "chest_type")

@admin.register(UserEventCurrency)
class UserEventCurrencyAdmin(ModelAdmin):
    list_display = ("telegram", "event", "amount")
    list_filter = ("event",)
    search_fields = ("telegram__telegram_id",)

@admin.register(MatchHistory)
class MatchHistoryAdmin(ModelAdmin):
    list_display = ("id", "match", "telegram", "mode", "result", "created_at")
    list_filter = ("mode", "result")
    search_fields = ("telegram__telegram_id",)

@admin.register(GhostBots)
class GhostBotsAdmin(ModelAdmin):
    list_display = ("telegram", "is_active")
    list_filter = ("is_active",)
    search_fields = ("telegram__telegram_id",)

@admin.register(FriendRequests)
class FriendRequestsAdmin(ModelAdmin):
    list_display = ("id", "from_telegram", "to_telegram", "status", "created_at", "responded_at")
    list_filter = ("status",)
    search_fields = ("from_telegram__telegram_id", "to_telegram__telegram_id")

@admin.register(GameInvites)
class GameInvitesAdmin(ModelAdmin):
    list_display = ("id", "from_telegram", "to_telegram", "room_id", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("from_telegram__telegram_id", "to_telegram__telegram_id", "room_id")

@admin.register(Matches)
class MatchesAdmin(ModelAdmin):
    list_display = ("id", "room_id", "mode", "is_ranked", "status", "winner_team", "created_at")
    list_filter = ("mode", "is_ranked", "status")
    search_fields = ("room_id",)

@admin.register(MatchPlayers)
class MatchPlayersAdmin(ModelAdmin):
    list_display = ("id", "match", "telegram", "team", "result", "rating_delta")
    list_filter = ("team", "result")
    search_fields = ("match__id", "telegram__telegram_id")

@admin.register(RewardedSessions)
class RewardedSessionsAdmin(ModelAdmin):
    list_display = ("id", "telegram", "reward_type", "reward_amount", "status", "created_at")
    list_filter = ("reward_type", "status")
    search_fields = ("id", "telegram__telegram_id")

@admin.register(UserEquippedItems)
class UserEquippedItemsAdmin(ModelAdmin):
    list_display = ("telegram", "equipped_deck_id", "equipped_background_id", "updated_at")
    search_fields = ("telegram__telegram_id", "equipped_deck_id", "equipped_background_id")

@admin.register(UserFriends)
class UserFriendsAdmin(ModelAdmin):
    list_display = ("id", "user_telegram", "friend_telegram", "created_at")
    search_fields = ("user_telegram__telegram_id", "friend_telegram__telegram_id")

@admin.register(UserQuestProgress)
class UserQuestProgressAdmin(ModelAdmin):
    list_display = ("telegram", "quest", "current_amount", "is_completed", "is_claimed")
    list_filter = ("is_completed", "is_claimed")
    search_fields = ("telegram__telegram_id", "quest__id")

@admin.register(UserRewards)
class UserRewardsAdmin(ModelAdmin):
    list_display = ("id", "telegram", "reward_key", "title", "rarity", "unlocked_at")
    list_filter = ("rarity",)
    search_fields = ("telegram__telegram_id", "reward_key", "title")

@admin.register(WalletTransactions)
class WalletTransactionsAdmin(ModelAdmin):
    list_display = ("id", "telegram", "amount", "currency", "tx_type", "created_at")
    list_filter = ("currency", "tx_type")
    search_fields = ("telegram__telegram_id",)

@admin.register(SqlxMigrations)
class SqlxMigrationsAdmin(ModelAdmin):
    list_display = ("version", "description", "installed_on", "success", "execution_time")
    list_filter = ("success",)
    search_fields = ("description",)
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False



@admin.register(Clans)
class ClansAdmin(ModelAdmin):
    list_display = ("id", "name", "tag", "owner", "rating", "trophies", "created_at")
    search_fields = ("name", "tag")

@admin.register(ClanMembers)
class ClanMembersAdmin(ModelAdmin):
    list_display = ("clan", "telegram", "role", "joined_at")
    list_filter = ("role",)
    search_fields = ("clan__name", "telegram__telegram_id")

@admin.register(Tournaments)
class TournamentsAdmin(ModelAdmin):
    list_display = ("id", "title", "status", "start_time", "end_time")
    list_filter = ("status",)
    search_fields = ("title",)

@admin.register(TournamentRegistrations)
class TournamentRegistrationsAdmin(ModelAdmin):
    list_display = ("id", "tournament", "clan", "registered_at")
    list_filter = ("tournament",)
    search_fields = ("clan__name",)

@admin.register(TournamentSquads)
class TournamentSquadsAdmin(ModelAdmin):
    list_display = ("id", "registration", "telegram", "is_substitute")
    list_filter = ("is_substitute",)
    search_fields = ("telegram__telegram_id", "registration__clan__name")

@admin.register(TournamentMatches)
class TournamentMatchesAdmin(ModelAdmin):
    list_display = ("id", "tournament", "round", "match_index", "clan1", "clan2", "winner")
    list_filter = ("tournament", "round")
    search_fields = ("room_id",)

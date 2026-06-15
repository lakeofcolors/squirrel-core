from django.contrib import admin
from django.db import models
from django.utils import timezone
from datetime import timedelta
from unfold.admin import ModelAdmin, TabularInline, StackedInline

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

# ==========================================
# BASE MODEL ADMIN FOR UNFOLD DESIGN
# ==========================================

class BaseModelAdmin(ModelAdmin):
    compressed = True
    warn_to_navigate_and_leave = True
    list_filter_submit = True
    list_fullwidth = True

# ==========================================
# INLINES CONFIGURATION
# ==========================================

class EventQuestsInline(TabularInline):
    model = EventQuests
    extra = 1

class EventShopItemsInline(TabularInline):
    model = EventShopItems
    extra = 1

class UserInventoryInline(TabularInline):
    model = UserInventory
    extra = 0
    raw_id_fields = ("telegram",)

class UserChestsInline(TabularInline):
    model = UserChests
    extra = 0
    raw_id_fields = ("telegram",)

class UserEquippedItemsInline(StackedInline):
    model = UserEquippedItems
    extra = 0
    raw_id_fields = ("telegram",)

class UserRewardsInline(TabularInline):
    model = UserRewards
    extra = 0
    raw_id_fields = ("telegram",)

class MatchHistoryInline(TabularInline):
    model = MatchHistory
    extra = 0
    raw_id_fields = ("telegram", "match")
    readonly_fields = ("match", "room_id", "mode", "result", "rating_delta", "created_at")
    can_delete = False

class ClanMembersInline(TabularInline):
    model = ClanMembers
    extra = 0
    raw_id_fields = ("telegram",)

class TournamentRegistrationsInline(TabularInline):
    model = TournamentRegistrations
    extra = 0
    raw_id_fields = ("clan",)

class TournamentMatchesInline(TabularInline):
    model = TournamentMatches
    extra = 0
    raw_id_fields = ("clan1", "clan2", "winner")

# ==========================================
# MODEL ADMINS WITH ACTIONS & INLINES
# ==========================================

@admin.register(Users)
class UsersAdmin(BaseModelAdmin):
    list_display = (
        "telegram_id", "username", "rating", "free_coins", "tournament_coins",
        "slots_free_spins", "ton_balance", "xp", "daily_streak"
    )
    search_fields = ("telegram_id", "username")
    list_filter = ("daily_streak",)
    
    inlines = [
        UserInventoryInline,
        UserChestsInline,
        UserEquippedItemsInline,
        UserRewardsInline,
        MatchHistoryInline
    ]

    actions = [
        "give_1000_coins",
        "give_5000_coins",
        "give_100_free_spins",
        "give_10_ton",
        "give_1000_tournament_coins",
        "give_common_chest",
        "give_epic_chest",
        "activate_xp_booster",
        "activate_nuts_booster",
        "activate_weekly_boosters",
        "clear_active_boosters",
        "reset_rating",
        "reset_daily_streak",
        "set_streak_day_6",
        "unlock_all_cosmetics"
    ]

    @admin.action(description="Начислить 1000 орехов (free_coins)")
    def give_1000_coins(self, request, queryset):
        updated = queryset.update(free_coins=models.F('free_coins') + 1000)
        self.message_user(request, f"Успешно начислено по 1000 орехов {updated} пользователям.")

    @admin.action(description="Начислить 5000 орехов (free_coins)")
    def give_5000_coins(self, request, queryset):
        updated = queryset.update(free_coins=models.F('free_coins') + 5000)
        self.message_user(request, f"Успешно начислено по 5000 орехов {updated} пользователям.")

    @admin.action(description="Начислить 100 бесплатных спинов")
    def give_100_free_spins(self, request, queryset):
        updated = queryset.update(slots_free_spins=models.F('slots_free_spins') + 100)
        self.message_user(request, f"Успешно начислено по 100 спинов {updated} пользователям.")

    @admin.action(description="Начислить 10 TON")
    def give_10_ton(self, request, queryset):
        # 10 TON = 10_000_000_000 nanotons
        updated = queryset.update(ton_balance=models.F('ton_balance') + 10000000000)
        self.message_user(request, f"Успешно начислено по 10 TON {updated} пользователям.")

    @admin.action(description="Начислить 1000 турнирных монет")
    def give_1000_tournament_coins(self, request, queryset):
        updated = queryset.update(tournament_coins=models.F('tournament_coins') + 1000)
        self.message_user(request, f"Успешно начислено по 1000 турнирных монет {updated} пользователям.")

    @admin.action(description="Выдать обычный сундук")
    def give_common_chest(self, request, queryset):
        count = 0
        for user in queryset:
            chest, created = UserChests.objects.get_or_create(
                telegram=user,
                chest_type='common',
                defaults={'amount': 1, 'created_at': timezone.now(), 'updated_at': timezone.now()}
            )
            if not created:
                chest.amount += 1
                chest.updated_at = timezone.now()
                chest.save()
            count += 1
        self.message_user(request, f"Выдано по одному обычному сундуку {count} пользователям.")

    @admin.action(description="Выдать эпический сундук")
    def give_epic_chest(self, request, queryset):
        count = 0
        for user in queryset:
            chest, created = UserChests.objects.get_or_create(
                telegram=user,
                chest_type='epic',
                defaults={'amount': 1, 'created_at': timezone.now(), 'updated_at': timezone.now()}
            )
            if not created:
                chest.amount += 1
                chest.updated_at = timezone.now()
                chest.save()
            count += 1
        self.message_user(request, f"Выдано по одному эпическому сундуку {count} пользователям.")

    @admin.action(description="Активировать бустер XP (24 часа)")
    def activate_xp_booster(self, request, queryset):
        ends_at = timezone.now() + timedelta(hours=24)
        updated = queryset.update(xp_booster_ends_at=ends_at)
        self.message_user(request, f"Активирован XP бустер на 24 часа для {updated} пользователей.")

    @admin.action(description="Активировать бустер монет (24 часа)")
    def activate_nuts_booster(self, request, queryset):
        ends_at = timezone.now() + timedelta(hours=24)
        updated = queryset.update(nuts_booster_ends_at=ends_at)
        self.message_user(request, f"Активирован бустер монет на 24 часа для {updated} пользователей.")

    @admin.action(description="Активировать бустеры XP и монет на 7 дней")
    def activate_weekly_boosters(self, request, queryset):
        ends_at = timezone.now() + timedelta(days=7)
        updated = queryset.update(xp_booster_ends_at=ends_at, nuts_booster_ends_at=ends_at)
        self.message_user(request, f"Активированы бустеры XP и монет на 7 дней для {updated} пользователей.")

    @admin.action(description="Сбросить все активные бустеры")
    def clear_active_boosters(self, request, queryset):
        updated = queryset.update(xp_booster_ends_at=None, nuts_booster_ends_at=None)
        self.message_user(request, f"Активные временные бустеры сброшены для {updated} пользователей.")

    @admin.action(description="Сбросить рейтинг до 1000")
    def reset_rating(self, request, queryset):
        updated = queryset.update(rating=1000)
        self.message_user(request, f"Рейтинг сброшен до 1000 для {updated} пользователей.")

    @admin.action(description="Сбросить ежедневную серию и клеймы")
    def reset_daily_streak(self, request, queryset):
        updated = queryset.update(daily_streak=0, last_daily_claim=None)
        self.message_user(request, f"Серия клеймов сброшена для {updated} пользователей.")

    @admin.action(description="Установить серию = 6 дней (готово к дню 7)")
    def set_streak_day_6(self, request, queryset):
        yesterday = timezone.now() - timedelta(days=1)
        updated = queryset.update(daily_streak=6, last_daily_claim=yesterday)
        self.message_user(request, f"Установлена серия 6 дней (клейм вчера) для {updated} пользователей.")

    @admin.action(description="Открыть все активные косметические предметы")
    def unlock_all_cosmetics(self, request, queryset):
        active_cosmetics = StoreCosmetics.objects.filter(is_active=True)
        added_count = 0
        for user in queryset:
            for cosmetic in active_cosmetics:
                obj, created = UserInventory.objects.get_or_create(
                    telegram=user,
                    item_type=cosmetic.item_type,
                    item_id=cosmetic.item_key,
                    defaults={'created_at': timezone.now()}
                )
                if created:
                    added_count += 1
        self.message_user(request, f"Успешно разблокировано {added_count} косметических предметов для выбранных пользователей.")


@admin.register(Events)
class EventsAdmin(BaseModelAdmin):
    list_display = ("key", "title", "is_active", "start_time", "end_time")
    list_filter = ("is_active",)
    search_fields = ("key", "title")
    inlines = [EventQuestsInline, EventShopItemsInline]
    actions = ["activate_event", "extend_event_7_days", "end_event_now", "reset_all_user_progress"]

    @admin.action(description="Активировать событие (деактивировать остальные)")
    def activate_event(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Пожалуйста, выберите ровно одно событие для активации.", level='error')
            return
        event = queryset.first()
        Events.objects.all().update(is_active=False)
        event.is_active = True
        event.save()
        self.message_user(request, f"Событие '{event.title}' успешно активировано. Все остальные события деактивированы.")

    @admin.action(description="Продлить событие на 7 дней")
    def extend_event_7_days(self, request, queryset):
        for event in queryset:
            event.end_time = event.end_time + timedelta(days=7)
            event.save()
        self.message_user(request, f"Срок окончания продлен на 7 дней для {queryset.count()} событий.")

    @admin.action(description="Завершить событие прямо сейчас")
    def end_event_now(self, request, queryset):
        updated = queryset.update(end_time=timezone.now() - timedelta(minutes=1))
        self.message_user(request, f"Событий завершено: {updated}.")

    @admin.action(description="Сбросить прогресс квестов события для всех игроков")
    def reset_all_user_progress(self, request, queryset):
        quest_ids = EventQuests.objects.filter(event__in=queryset).values_list('id', flat=True)
        deleted_count, _ = UserQuestProgress.objects.filter(quest_id__in=quest_ids).delete()
        self.message_user(request, f"Удалено {deleted_count} записей о прогрессе квестов.")


@admin.register(EventShopItems)
class EventShopItemsAdmin(BaseModelAdmin):
    list_display = ("id", "event", "item_type", "item_id", "title", "cost", "max_purchases")
    list_filter = ("event", "item_type")
    search_fields = ("title", "item_id")


@admin.register(EventQuests)
class EventQuestsAdmin(BaseModelAdmin):
    list_display = ("id", "event", "quest_type", "title", "target_amount", "reward_type", "reward_amount")
    list_filter = ("event", "quest_type", "reward_type")
    search_fields = ("title",)


@admin.register(StoreCosmetics)
class StoreCosmeticsAdmin(BaseModelAdmin):
    list_display = ("id", "item_type", "item_key", "title", "price_nuts", "rarity", "is_active")
    list_filter = ("item_type", "rarity", "is_active")
    search_fields = ("title", "item_key")


@admin.register(StoreNutsPacks)
class StoreNutsPacksAdmin(BaseModelAdmin):
    list_display = ("id", "title", "nuts_amount", "xtr_amount", "is_featured", "is_active")
    list_filter = ("is_active", "is_featured")


@admin.register(StoreOrders)
class StoreOrdersAdmin(BaseModelAdmin):
    list_display = ("id", "telegram", "product_id", "status", "nuts_amount", "xtr_amount", "created_at")
    list_filter = ("status",)
    search_fields = ("id", "product_id")
    actions = ["simulate_payment_success"]

    @admin.action(description="Симулировать успешную оплату (Mark Paid & Topup)")
    def simulate_payment_success(self, request, queryset):
        success_count = 0
        for order in queryset:
            if order.status != 'paid':
                user = order.telegram
                user.free_coins = (user.free_coins or 0) + order.nuts_amount
                user.save()

                WalletTransactions.objects.create(
                    telegram=user,
                    amount=order.nuts_amount,
                    currency='nuts',
                    tx_type='topup',
                    metadata=f"mock_payment:{order.id}",
                    created_at=timezone.now()
                )

                order.status = 'paid'
                order.paid_at = timezone.now()
                order.telegram_payment_charge_id = f"mock_tg_charge_{order.id}"
                order.provider_payment_charge_id = f"mock_prov_charge_{order.id}"
                order.save()
                success_count += 1
        self.message_user(request, f"Успешно обработано и оплачено заказов: {success_count}.")


@admin.register(UserInventory)
class UserInventoryAdmin(BaseModelAdmin):
    list_display = ("id", "telegram", "item_type", "item_id", "created_at")
    list_filter = ("item_type",)
    search_fields = ("telegram__telegram_id", "item_id")


@admin.register(UserBoosters)
class UserBoostersAdmin(BaseModelAdmin):
    list_display = ("telegram", "booster_id", "amount", "updated_at")
    search_fields = ("telegram__telegram_id", "booster_id")


@admin.register(UserChests)
class UserChestsAdmin(BaseModelAdmin):
    list_display = ("id", "telegram", "chest_type", "amount", "updated_at")
    search_fields = ("telegram__telegram_id", "chest_type")


@admin.register(UserEventCurrency)
class UserEventCurrencyAdmin(BaseModelAdmin):
    list_display = ("telegram", "event", "amount")
    list_filter = ("event",)
    search_fields = ("telegram__telegram_id",)


@admin.register(MatchHistory)
class MatchHistoryAdmin(BaseModelAdmin):
    list_display = ("id", "match", "telegram", "mode", "result", "created_at")
    list_filter = ("mode", "result")
    search_fields = ("telegram__telegram_id",)


@admin.register(GhostBots)
class GhostBotsAdmin(BaseModelAdmin):
    list_display = ("telegram", "is_active")
    list_filter = ("is_active",)
    search_fields = ("telegram__telegram_id",)


@admin.register(FriendRequests)
class FriendRequestsAdmin(BaseModelAdmin):
    list_display = ("id", "from_telegram", "to_telegram", "status", "created_at", "responded_at")
    list_filter = ("status",)
    search_fields = ("from_telegram__telegram_id", "to_telegram__telegram_id")


@admin.register(GameInvites)
class GameInvitesAdmin(BaseModelAdmin):
    list_display = ("id", "from_telegram", "to_telegram", "room_id", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("from_telegram__telegram_id", "to_telegram__telegram_id", "room_id")


@admin.register(Matches)
class MatchesAdmin(BaseModelAdmin):
    list_display = ("id", "room_id", "mode", "is_ranked", "status", "winner_team", "created_at")
    list_filter = ("mode", "is_ranked", "status")
    search_fields = ("room_id",)
    actions = ["cancel_matches", "finish_as_draw", "finish_win_team_a", "finish_win_team_b", "clear_replay_events"]

    @admin.action(description="Отменить выбранные матчи")
    def cancel_matches(self, request, queryset):
        updated = queryset.update(status='cancelled')
        self.message_user(request, f"Отменено матчей: {updated}.")

    @admin.action(description="Симулировать завершение вничью (Draw)")
    def finish_as_draw(self, request, queryset):
        updated = queryset.update(
            status='finished',
            winner_team=None,
            end_reason='draw',
            finished_at=timezone.now()
        )
        self.message_user(request, f"Матчей завершено вничью: {updated}.")

    @admin.action(description="Симулировать победу команды А")
    def finish_win_team_a(self, request, queryset):
        updated = queryset.update(
            status='finished',
            winner_team='A',
            end_reason='normal',
            finished_at=timezone.now()
        )
        self.message_user(request, f"Матчей завершено с победой команды А: {updated}.")

    @admin.action(description="Симулировать победу команды B")
    def finish_win_team_b(self, request, queryset):
        updated = queryset.update(
            status='finished',
            winner_team='B',
            end_reason='normal',
            finished_at=timezone.now()
        )
        self.message_user(request, f"Матчей завершено с победой команды B: {updated}.")

    @admin.action(description="Очистить события реплея")
    def clear_replay_events(self, request, queryset):
        updated = queryset.update(replay_events=None)
        self.message_user(request, f"События реплея очищены для {updated} матчей.")


@admin.register(MatchPlayers)
class MatchPlayersAdmin(BaseModelAdmin):
    list_display = ("id", "match", "telegram", "team", "result", "rating_delta")
    list_filter = ("team", "result")
    search_fields = ("match__id", "telegram__telegram_id")


@admin.register(RewardedSessions)
class RewardedSessionsAdmin(BaseModelAdmin):
    list_display = ("id", "telegram", "reward_type", "reward_amount", "status", "created_at")
    list_filter = ("reward_type", "status")
    search_fields = ("id", "telegram__telegram_id")


@admin.register(UserEquippedItems)
class UserEquippedItemsAdmin(BaseModelAdmin):
    list_display = ("telegram", "equipped_deck_id", "equipped_background_id", "updated_at")
    search_fields = ("telegram__telegram_id", "equipped_deck_id", "equipped_background_id")


@admin.register(UserFriends)
class UserFriendsAdmin(BaseModelAdmin):
    list_display = ("id", "user_telegram", "friend_telegram", "created_at")
    search_fields = ("user_telegram__telegram_id", "friend_telegram__telegram_id")


@admin.register(UserQuestProgress)
class UserQuestProgressAdmin(BaseModelAdmin):
    list_display = ("telegram", "quest", "current_amount", "is_completed", "is_claimed")
    list_filter = ("is_completed", "is_claimed")
    search_fields = ("telegram__telegram_id", "quest__id")


@admin.register(UserRewards)
class UserRewardsAdmin(BaseModelAdmin):
    list_display = ("id", "telegram", "reward_key", "title", "rarity", "unlocked_at")
    list_filter = ("rarity",)
    search_fields = ("telegram__telegram_id", "reward_key", "title")


@admin.register(WalletTransactions)
class WalletTransactionsAdmin(BaseModelAdmin):
    list_display = ("id", "telegram", "amount", "currency", "tx_type", "created_at")
    list_filter = ("currency", "tx_type")
    search_fields = ("telegram__telegram_id",)


@admin.register(SqlxMigrations)
class SqlxMigrationsAdmin(BaseModelAdmin):
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
class ClansAdmin(BaseModelAdmin):
    list_display = ("id", "name", "tag", "owner", "rating", "trophies", "created_at")
    search_fields = ("name", "tag")
    inlines = [ClanMembersInline]
    actions = ["add_1000_trophies", "add_5000_trophies", "reset_trophies"]

    @admin.action(description="Добавить +1000 кубков")
    def add_1000_trophies(self, request, queryset):
        updated = queryset.update(trophies=models.F('trophies') + 1000)
        self.message_user(request, f"Добавлено по 1000 кубков {updated} кланам.")

    @admin.action(description="Добавить +5000 кубков")
    def add_5000_trophies(self, request, queryset):
        updated = queryset.update(trophies=models.F('trophies') + 5000)
        self.message_user(request, f"Добавлено по 5000 кубков {updated} кланам.")

    @admin.action(description="Сбросить кубки до 0")
    def reset_trophies(self, request, queryset):
        updated = queryset.update(trophies=0)
        self.message_user(request, f"Кубки сброшены до 0 для {updated} кланов.")


@admin.register(ClanMembers)
class ClanMembersAdmin(BaseModelAdmin):
    list_display = ("clan", "telegram", "role", "joined_at")
    list_filter = ("role",)
    search_fields = ("clan__name", "telegram__telegram_id")


@admin.register(Tournaments)
class TournamentsAdmin(BaseModelAdmin):
    list_display = ("id", "title", "status", "start_time", "end_time")
    list_filter = ("status",)
    search_fields = ("title",)
    inlines = [TournamentRegistrationsInline, TournamentMatchesInline]


@admin.register(TournamentRegistrations)
class TournamentRegistrationsAdmin(BaseModelAdmin):
    list_display = ("id", "tournament", "clan", "registered_at")
    list_filter = ("tournament",)
    search_fields = ("clan__name",)


@admin.register(TournamentSquads)
class TournamentSquadsAdmin(BaseModelAdmin):
    list_display = ("id", "registration", "telegram", "is_substitute")
    list_filter = ("is_substitute",)
    search_fields = ("telegram__telegram_id", "registration__clan__name")


@admin.register(TournamentMatches)
class TournamentMatchesAdmin(BaseModelAdmin):
    list_display = ("id", "tournament", "round", "match_index", "clan1", "clan2", "winner")
    list_filter = ("tournament", "round")
    search_fields = ("room_id",)

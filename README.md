
# squirrel-core

curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/telegram/webhook"

curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.lakeofcolors.com/telegram/webhook",
    "allowed_updates": ["message", "pre_checkout_query"]
  }'

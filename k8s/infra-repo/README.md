# Squirrel Infrastructure (Helmfile & GitOps)

Этот репозиторий содержит декларативное описание всей базовой инфраструктуры твоего Kubernetes-кластера (k3s).

## Структура репозитория
* `helmfile.yaml` — главный файл, описывающий все Helm-релизы и их зависимости.
* `values/` — конфигурационные файлы (Helm values) для GitLab, Prometheus, Runner.
* `manifests/` — "сырые" Kubernetes-манифесты (Ingress-правила, сертификаты Cert-Manager, конфигурация MetalLB).

---

## 🚀 Как развернуть инфраструктуру вручную
Убедись, что твой `kubectl` настроен на подключение к твоему серверу k3s.

1. Установи `helmfile` и плагин `helm-diff`:
   ```bash
   # macOS
   brew install helmfile
   helm plugin install https://github.com/databus23/helm-diff
   ```
2. Запусти синхронизацию кластера с кодом:
   ```bash
   helmfile apply
   ```

---

## 🤖 Автоматический деплой через CI/CD
Для того чтобы изменения применялись автоматически при пуше в ветку `main`:
1. Зайди в настройки GitLab проекта: **Settings ➡️ CI/CD ➡️ Variables**.
2. Добавь переменную `KUBECONFIG`.
3. Установи тип: **File**.
4. В качестве значения вставь содержимое твоего файла `~/.kube/config` с сервера k3s.
5. При пуше в `main` пайплайн автоматически запустит `helmfile apply --non-interactive`.

---

## 🔒 Шифрование секретов с помощью Sealed Secrets

В этом репозитории развернут контроллер **Sealed Secrets** (от Bitnami), который позволяет шифровать секреты асимметричным ключом. Зашифрованный файл можно безопасно коммитить в Git. Расшифровать его сможет только контроллер внутри твоего кластера k3s.

### Инструкция по созданию секретов:
1. **Установи утилиту `kubeseal` на свой компьютер**:
   ```bash
   # macOS
   brew install kubeseal
   ```
2. **Получи публичный сертификат из твоего кластера** (нужно сделать один раз):
   ```bash
   kubeseal --controller-name=sealed-secrets-controller --controller-namespace=kube-system --fetch-cert > pub-cert.pem
   ```
   *Файл `pub-cert.pem` содержит только публичный ключ, его можно безопасно хранить в репозитории.*

3. **Создай обычный манифест секрета** (например, `secrets.yaml`):
   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: squirrel-secrets
     namespace: game
   type: Opaque
   stringData:
     POSTGRES_PASSWORD: "my-super-secret-password"
     BOT_TOKEN: "123456:ABC-DEF"
   ```
4. **Зашифруй его с помощью `kubeseal`**:
   ```bash
   kubeseal --format=yaml --cert=pub-cert.pem < secrets.yaml > sealed-secret.yaml
   ```
5. **Удали файл `secrets.yaml`** с жесткого диска.
6. **Закомить и запушь `sealed-secret.yaml`** в репозиторий твоего приложения! Теперь Kubernetes сам превратит его в обычный `Secret` при накате в кластер.

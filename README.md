# Albion Market Insights

Dashboard **privado** de análise de mercado do Albion Online. Duas fontes de
dados, sempre identificadas:

- **`private`** — só o que o teu client manda pro teu servidor. Nunca sobe
  pra rede pública do Albion Data Project. É a tua vantagem competitiva.
- **`public_adp`** — baseline de fallback puxado da API pública do AODP,
  só pros itens que você registrar na watchlist (não sincroniza o catálogo
  inteiro).

Todo endpoint de preço retorna de qual fonte veio (`source`) e, no `/latest`,
sempre mostra o dado mais recente entre as duas por cidade.

## 🔒 O ponto mais importante: manter o client 100% privado

Por padrão o `albiondata-client` sobe os dados pro NATS público do AODP
(`nats://public:thenewalbiondata@www.albion-online-data.com:4222`), que é
lido por qualquer ferramenta pública. **Isso é o que você quer evitar.**

O client tem a flag `-i` (base URL de upload), que aceita `nats://`, `http://`
ou `noop`, e pode ter múltiplos valores separados por vírgula. Pra mandar
**só** pro teu servidor privado, sobrescreva o padrão:

```bash
albiondata-client -i "http://SEU_IP_OU_DOMINIO:3000/api/ingest"
```

Se o teu ingest bridge local (o que já existia no teu pipeline, capturando
UDP e repassando via Express) já intercepta antes de sair pra rede, o mais
seguro é apontar o `-i` só pra ele e nunca incluir a URL `nats://` pública
na lista. Confirma isso rodando `albiondata-client -h` e conferindo que só
tem a tua URL configurada — se aparecer a `nats://` default junto, os dados
estão indo pros dois lugares.

⚠️ Isso é config de rede do client, então revise sempre que atualizar a
versão — o valor padrão da flag `-i` pode mudar entre releases.

## Setup

```bash
npm install
cp .env.example .env
npm run import:items   # baixa items.json do ao-bin-dumps, popula nomes PT-BR (~12k itens)
npm start               # sobe o servidor em http://localhost:3000
```

## Fluxo privado (contribuidores do teu client)

1. Criar API key de contribuidor:

```bash
curl -X POST localhost:3000/api/admin/contributors \
  -H "x-admin-secret: SEU_SEGREDO" -H "Content-Type: application/json" \
  -d '{"name":"PC do Txaga"}'
```

2. O client/bridge manda os preços pra `/api/ingest` com essa chave — esses
   registros sempre gravam com `source = 'private'`.

## Fluxo público (baseline de fallback)

1. Adicionar item na watchlist (só o que você quer cobertura pública):

```bash
curl -X POST localhost:3000/api/admin/watchlist \
  -H "x-admin-secret: SEU_SEGREDO" -H "Content-Type: application/json" \
  -d '{"itemId":"T4_BAG"}'
```

2. Rodar a sincronização (manual ou via cron):

```bash
npm run sync:public
# ou, com o servidor no ar:
curl -X POST localhost:3000/api/admin/sync-public -H "x-admin-secret: SEU_SEGREDO"
```

Isso lê da API pública do AODP (`europe.albion-online-data.com` por padrão,
configurável via `PUBLIC_SYNC_REGION`) e grava com `source = 'public_adp'`.
É uma via de mão única — o script só lê de lá, nunca escreve nada de volta.

## Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/items?search=&tier=` | Busca itens por nome PT-BR / tier |
| GET | `/api/items/:uniqueName` | Detalhe de um item |
| GET | `/api/prices/:uniqueName?city=&source=&limit=` | Histórico de preços com `source` |
| GET | `/api/prices/:uniqueName/latest` | Preço mais recente por cidade, com `source` |
| POST | `/api/ingest` | Ingestão privada (requer `x-api-key`) |
| POST | `/api/admin/contributors` | Cria contribuidor + API key |
| GET/PATCH | `/api/admin/contributors...` | Lista / revoga contribuidores |
| POST/GET/DELETE | `/api/admin/watchlist` | Gerencia itens com baseline público |
| POST | `/api/admin/sync-public` | Dispara sync manual com o AODP |

(todas as rotas `/api/admin/*` exigem `x-admin-secret`)

## Próximos passos sugeridos

- `public/` é onde entra teu dashboard de verdade (React/vanilla/etc).
- Rodar `npm run sync:public` num cron (ex: a cada 15-30min) só pros itens
  em watchlist que ainda não têm cobertura privada boa.
- Pra decidir cobertura: um item com contribuição privada frequente nem
  precisa estar na watchlist pública — economiza rate limit do AODP.
- Rodar `npm run import:items` periodicamente (o ao-bin-dumps atualiza por
  patch).

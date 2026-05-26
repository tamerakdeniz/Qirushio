# Qirushio

Arkadaşlarla link veya kısa oda kodu üzerinden oynanan, her turda AI tarafından yeni sorular üretilen gerçek zamanlı multiplayer quiz MVP'si.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4
- Supabase Postgres, Realtime Broadcast ve Presence
- Gemini API veya Claude API ile server-side soru üretimi
- Vercel deployment ve süresi dolan odalar için korumalı Cron endpoint'i

## Özellikler

- Local storage üzerinde saklanan takma ad ve oda bazlı güvenli oyuncu oturumu
- Oda oluşturma, kodla katılma ve katılıma açık lobi listesi
- Türkçe/İngilizce arayüz ve oda bazlı soru dili seçimi
- Host ayarları: tüm kategorilere yayılan rastgele soru havuzu dahil kategori, zorluk, kapsam, soru sayısı, süre ve açık/gizli oda
- Kalıcı açık/koyu tema seçimi, responsive arka plan görselleri ve koyu temada okunabilirliği koruyan karartma katmanı
- Lobi hazır durumu, bağlantı paylaşımı ve Presence ile çevrimiçi göstergesi
- AI hazırlık ekranı, 10 saniyelik oyun başlangıcı ve sorular arası 3 saniyelik geçiş
- Beş seçenekli kilitlenen cevap akışı ve herkes cevapladığında erken ilerleme
- Leaderboard, tekrar oynama, lobiye dönüş ve kişisel cevap analizi
- Dört saatlik oda TTL'i; silinen oda ile birlikte oyuncular, sorular ve yanıtlar cascade silinir

## Yerel Kurulum

Gereksinim: Node.js 20.9 veya daha yeni bir LTS sürümü.

```bash
npm install
cp .env.example .env.local
npm run dev
```

1. Bir Supabase projesi oluşturun.
2. [supabase/migrations](./supabase/migrations) altındaki migration dosyalarını sırasıyla çalıştırın veya Supabase CLI migration akışınıza ekleyin.
3. `.env.local` içinde Supabase URL, anon key ve service role key değerlerini doldurun.
4. Gemini veya Anthropic anahtarlarından birini ekleyin. Her ikisi verilirse Gemini kullanılır.
5. Yalnızca yerel UI/akış kontrolünde AI anahtarı olmadan oynamak için `ALLOW_DEMO_QUESTIONS=true` kullanabilirsiniz.

## Environment

| Değişken | Nerede kullanılır | Açıklama |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase proje URL'i |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Realtime Broadcast ve Presence bağlantısı |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | API route'larının veri erişimi ve RPC çalıştırması |
| `GEMINI_API_KEY` | Server only | Gemini soru üretimi |
| `GEMINI_MODEL` | Server only | Varsayılan: `gemini-2.5-flash` |
| `ANTHROPIC_API_KEY` | Server only | Claude soru üretimi |
| `ANTHROPIC_MODEL` | Server only | Varsayılan: `claude-haiku-4-5-20251001` |
| `CRON_SECRET` | Server only | `/api/cron/cleanup` isteğini korur |
| `ALLOW_DEMO_QUESTIONS` | Server only | Yerel geliştirme fallback'i; production'da `false` kalmalı |
| `NEXT_PUBLIC_SITE_URL` | Build + metadata | Canonical URL (`http://qurisho.tamerakdeniz.com`); OG, sitemap ve robots için |

AI model varsayılanları sağlayıcıların resmi belgelerindeki kararlı/üretim kimliklerine göre seçildi:
[Gemini modelleri](https://ai.google.dev/gemini-api/docs/models/gemini-v2) ve
[Claude modelleri](https://platform.claude.com/docs/en/docs/about-claude/models/all-models).

## Mimari

Tüm kalıcı veri erişimi Next.js API route'larında service role ile yapılır. Browser Supabase'i yalnızca oda değişikliği bildirimleri (`broadcast`) ve bağlantı durumu (`presence`) için kullanır.

- `rooms`: geçici oda, ayarlar ve aktif oyun fazı.
- `players`: oda içindeki oyuncular ve tur puanları.
- `player_sessions`: browser'a verilen rastgele token'ın SHA-256 özeti; RLS ile istemciye kapalı.
- `questions`: o tura ait AI soruları ve doğru cevapları; istemciye oyun bitene kadar doğru seçenek dönmez.
- `answers`: oyuncu yanıtı, kalan süre ve hesaplanan puan.

Önemli oyun işlemleri PostgreSQL RPC üzerinde atomiktir:

- `begin_round`: eski tur verisini siler, puanları sıfırlar ve AI üretim fazını başlatır.
- `submit_answer`: cevabı bir kez kabul eder ve puanı database saatine göre hesaplar.
- `advance_game`: süre sona erdiğinde veya herkes cevapladığında bir sonraki faza geçer.
- `return_to_lobby`: oyuncuları odada tutarak tur verisini temizler.

Skor hesabı server-side çalışır:

```ts
score = isCorrect ? Math.floor(remainingTimeMs / 1000) * 10 : 0;
```

## Deployment

1. Repository'yi Vercel'e bağlayın.
2. `.env.example` içindeki gerekli değerleri Vercel Environment Variables bölümüne girin.
3. Supabase migration'ını production projesine uygulayın.
4. `CRON_SECRET` değerini tanımlayın. [vercel.json](./vercel.json) içindeki günlük cron (03:00 UTC), süresi dolmuş odaları kaldıran korumalı endpoint'i çağırır. Vercel Hobby yalnızca günde bir cron destekler.
5. Deploy edin.

Açık lobi listesi (`GET /api/rooms`) her yüklendiğinde de `cleanup_expired_rooms` çalıştırır; cron atlanırsa bile eski odalar ana sayfada temizlenebilir. Daha sık temizlik için `/api/cron/cleanup` endpoint'ini `Authorization: Bearer <CRON_SECRET>` ile harici bir scheduler'dan tetikleyebilirsiniz.

## Komutlar

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Tasarım Asset'leri

Teslim edilen görsellerin kaynak dosyalarında yön adları ters olduğu için production asset adları gerçek kullanıma göre normalize edildi:

- `public/assets/background-mobile.png`: portre mobil arka plan
- `public/assets/background-desktop.png`: yatay desktop arka plan
- `public/assets/logo.png` ve `public/favicon.ico`: marka asset'leri

Orijinal referans ekranları ve HTML tasarımları `c&c-design/` klasöründe korunur.

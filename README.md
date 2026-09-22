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
- Host ayarları: genel kültür, bilim, spor, sanat ve tarihten oluşan rastgele havuz dahil (scuba ve tıp hariç) kategori, zorluk, kapsam, soru sayısı, süre ve açık/gizli oda
- Kalıcı açık/koyu tema seçimi, responsive arka plan görselleri ve koyu temada okunabilirliği koruyan karartma katmanı
- Lobi hazır durumu, bağlantı paylaşımı ve Presence ile çevrimiçi göstergesi
- AI hazırlık ekranı, 10 saniyelik oyun başlangıcı ve sorular arası 3 saniyelik geçiş
- Beş seçenekli kilitlenen cevap akışı ve herkes cevapladığında erken ilerleme
- Leaderboard, tekrar oynama, lobiye dönüş ve kişisel cevap analizi
- Son aktiviteden itibaren bir günlük oda TTL'i; oyun verileri temizlenirken kalıcı soru geçmişi korunur

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
| `GEMINI_API_KEY` | Server only | Birincil soru üretimi (Gemini) |
| `GEMINI_MODEL` | Server only | Varsayılan: `gemini-3.1-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | Server only | Rate limit'te: `gemini-2.5-flash-lite` |
| `ANTHROPIC_API_KEY` | Server only | Gemini kotası dolunca: Claude Haiku |
| `ANTHROPIC_MODEL` | Server only | Varsayılan: `claude-haiku-4-5-20251001` |
| `CRON_SECRET` | Server only | `/api/cron/cleanup` isteğini korur |
| `ALLOW_DEMO_QUESTIONS` | Server only | Yerel geliştirme fallback'i; production'da `false` kalmalı |
| `NEXT_PUBLIC_SITE_URL` | Build + metadata | Canonical URL (`http://qirushio.tamerakdeniz.com`); OG, sitemap ve robots için |

Soru üretimi sırası: `GEMINI_MODEL` → rate limit ise `GEMINI_FALLBACK_MODEL` → hâlâ limit ise `ANTHROPIC_MODEL`. Model kimlikleri: [Gemini](https://ai.google.dev/gemini-api/docs/models) ve [Claude](https://platform.claude.com/docs/en/docs/about-claude/models/all-models).

## Mimari

Tüm kalıcı veri erişimi Next.js API route'larında service role ile yapılır. Browser Supabase'i yalnızca oda değişikliği bildirimleri (`broadcast`) ve bağlantı durumu (`presence`) için kullanır.

- `rooms`: geçici oda, ayarlar ve aktif oyun fazı.
- `players`: oda içindeki oyuncular ve tur puanları.
- `player_sessions`: browser'a verilen rastgele token'ın SHA-256 özeti; RLS ile istemciye kapalı.
- `questions`: o tura ait AI soruları ve doğru cevapları; istemciye oyun bitene kadar doğru seçenek dönmez.
- `answers`: oyuncu yanıtı, kalan süre ve hesaplanan puan.
- `question_history`: oda ve oyuncudan bağımsız, süresiz soru hafızası; normalize metin, doğru cevap ve bilgi anahtarı içerir. Browser erişimine kapalıdır.

Önemli oyun işlemleri PostgreSQL RPC üzerinde atomiktir:

- `begin_round`: puanları sıfırlar ve yeni turun AI üretim fazını başlatır.
- `publish_generated_round`: tüm soruları ve kalıcı geçmişi tek transaction içinde kaydeder, ardından geri sayımı başlatır; bir tekrar varsa tamamını geri alır.
- `submit_answer`: cevabı bir kez kabul eder ve puanı database saatine göre hesaplar.
- `advance_game`: süre sona erdiğinde veya herkes cevapladığında bir sonraki faza geçer.
- `return_to_lobby`: oyuncuları odada tutarak puan ve hazır durumlarını sıfırlar.

Skor hesabı server-side çalışır:

```ts
score = isCorrect ? Math.floor(remainingTimeMs / 1000) * 10 : 0;
```

## Tıp modu

Ana sayfadaki **Tıp moduna geç** bağlantısı `/med` arayüzünü açar. Tıp, klasik oda oluşturma kategorilerinde yer almaz; kendi ekranında sınıf, ders, zorluk ve oda ayarları sunulur. Açık oda listesi de bu alan için tıp odalarını gösterir.

1–6. sınıflar tek tek veya birlikte seçilir: yalnızca 2, yalnızca 3, yalnızca 2 ve 3 gibi. Seçilmeyen önceki sınıflar dahil edilmez. `medical_years` ve `medical_subject` oda oluşturma, lobi düzenleme, oda özeti ve soru üretimi boyunca korunur. Eski odaların `medical_years` alanı null ise önceki kümülatif kapsam korunur. Kolay/orta/zor seçimi, seçilen sınıf kapsamı içinde uygulanır. Türkiye bağlamı sabittir; soru dili Türkçe veya İngilizce olabilir.

Modelin döndürdüğü `curriculumYear` seçili değilse veya belirli bir ders seçilmişken `medicalSubject` uyuşmuyorsa aday elenir. İçeriğin gerçek akademik düzeyi modelin doğru sınıflandırmasına bağlıdır. Sorular eğitim/tekrar amaçlıdır; sınıf konu dağılımı fakülteler arasında farklılık gösterebilir. Tıp soruları rastgele havuzuna dahil edilmez ve Gemini veya Anthropic anahtarı gerektirir.

Genel eğitim çerçevesi için [YÖK UÇEP](https://www.yok.gov.tr/kurumsal/idari-birimler/egitim-ogretim-dairesi/ulusal-cekirdek-egitimi-programlari), [Hacettepe](https://halksagligi.hacettepe.edu.tr/eng/egitim/lisans.php) ve [İstanbul Medeniyet](https://tip.medeniyet.edu.tr/tr/egitim/lisans) esas alındı; sınıf konu blokları oyunun pedagojik seçimidir.

Deploy öncesi `0015_medicine_category.sql`, `0016_medical_filters.sql` ve `0017_medical_subject_catalog.sql` uygulanmalıdır.

## Soru geçişleri

`POST /advance` güncel `RoomSnapshot` döndürür; istemci ayrıca `GET /state` beklemez. Geçişler ve normal durum okumaları aynı birleştirilmiş istek kuyruğunu kullanır. Oyuncu ve soru okumaları paraleldir. Cevaptan sonra tek bildirim, ilerletme tamamlandıktan sonra `after()` ile gönderilir. Zamanlayıcılar sunucu saatine göre düzeltilir; geçici hatalarda geçiş 500 ms sonra tekrar denenir.


## Kalıcı tekrar önleme

`0013_permanent_question_history.sql` ve `0014_generation_recovery_and_precise_dedup.sql` uygulama sürümünden **önce** uygulanmalıdır. Migration, halen DB’de bulunan tüm eski soruları (24 saatten eskiler dahil) kalıcı geçmişe aktarır. Daha önce silinmiş sorular geri getirilemez. Günlük cron yalnızca süresi dolan odaları ve oyun verilerini temizler. `reset.sql` de mevcut soru hafızasını korur.

Model son 80 soruyu örnek olarak görür; her adayın asıl kontrolü indeksli sorgularla **tüm geçmişe** karşı yapılır. Büyük/küçük harf, aksan, noktalama ve boşluk farkları normalize edilir. `pg_trgm` benzerliği, sunucu parametresi değiştirmeden açık `similarity(...) >= 0.55` karşılaştırmasıyla hesaplanır. Doğru cevap indeksi karşılaştırılacak kayıtları daraltır. Benzerlik ve aynı doğru cevap, küçük metin değişikliklerini yakalar; farklı cevaplı benzer cümle kalıpları tek başına tekrar sayılmaz; dil ve soru biçiminden bağımsız İngilizce `knowledgeKey` aynı bilginin başka şekilde sorulmasını azaltır. Bilgi anahtarı model tarafından üretildiği için bütün anlamsal eşdeğerlikleri yüzde yüz yakalama garantisi yoktur. Eski soruların bilgi anahtarı bulunmadığından bunlar metin/cevap benzerliğiyle kontrol edilir.

Kontrol tüm oyuncular ve odalar için ortaktır; dil, kategori veya zorluk değiştirmek geçmişi sıfırlamaz. Kayıt trigger'ı kısa bir transaction kilidiyle eşzamanlı oyunların çakışmasını engeller. Çakışmada tur tamamen geri alınır ve yeni adaylar üretilir. Üretim 100 saniyelik bütçe içinde sınırlı sayıda yeniden denenir; yeterli yeni soru yoksa tekrarlı/eksik sorularla başlamak yerine hata gösterilir. Aynı kural küçük demo havuzu için de geçerlidir. Üretim fazının DB’de 120 saniyelik son süresi vardır; sunucu süreci kesilirse süre dolduktan sonraki ilk oda isteği koşullu olarak lobiyi geri açar. Oyun ekranı, aynı anda gelen yenileme bildirimlerini tek takip isteğinde birleştirir; eski isteklerin yeni durumu ezmesi önlenir.

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

Veritabanı regresyon testleri: migration uygulanmış, izole bir geliştirme DB’sinde `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/question_history.sql`. Test verileri transaction sonunda geri alınır.

## Tasarım Asset'leri

Teslim edilen görsellerin kaynak dosyalarında yön adları ters olduğu için production asset adları gerçek kullanıma göre normalize edildi:

- `public/assets/background-mobile.png`: portre mobil arka plan
- `public/assets/background-desktop.png`: yatay desktop arka plan
- `public/assets/logo.png` ve `public/favicon.ico`: marka asset'leri

Orijinal referans ekranları ve HTML tasarımları `c&c-design/` klasöründe korunur.

### Tıp ders kataloğu ve görsel tema

Ders seçimi 55 tıbbi alanı dört grupta sunar: temel, dahili, cerrahi ve toplum sağlığı/hekimlik uygulamaları. Katalog [Hacettepe eğitim kapsamı](https://tip.hacettepe.edu.tr/tr/sss), [Dönem IV–VI staj rehberleri](https://tip.hacettepe.edu.tr/tr/staj_rehberi-35) ve [Ankara ders kataloğu](https://www.medicine.ankara.edu.tr/dersler-ve-kredileri/) ile karşılaştırılmıştır. Fakülteye özgü seçmeliler ve genel üniversite ortak dersleri, bu tıp konu kataloğuyla birebir eşdeğer değildir.

`/med` ve tıp odaları `background-medicine.webp` kullanır; renk paleti korunur. Görsel yerleşik image_gen aracıyla üretilmiş, WebP olarak yaklaşık 90 KB'a sıkıştırılmıştır. Üretim istemi `docs/medical-background-prompt.md` dosyasındadır.

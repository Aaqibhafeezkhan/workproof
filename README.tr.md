<p align="center"><img src="assets/wordmark.svg" width="480" alt="workproof"></p>

<p align="center"><a href="README.md">English</a> | Türkçe</p>

> Yaptığım işin çoğu özel repolarda. Orada ne yaptığımı, kodu göstermeden kimseye gösteremiyorum.

workproof is a command-line tool that turns a private git repository into a report of one author's work, with a hash a reader can check and no source code in it.

workproof, özel bir git deposunu tek bir yazarın işinin raporuna çeviren bir komut satırı aracıdır. Raporda kaynak kod yoktur; okuyan kişi raporun yazıldıktan sonra değiştirilmediğini bir hash ile denetleyebilir. Npm paketi `workproof`, github.com/Bubblegunn/workproof deposundan gelir ve TalentProof'un `workproof-schema` deposuyla bir ilgisi yoktur.

Node 22 veya daha yeni bir sürüm ile git gerekir. Aracı deponun içinde çalıştırın:

```
cd your-private-repo
npx workproof
```

Bu komut `workproof-report.md` dosyasını yazar (özgeçmişe, portfolyoya ya da vize başvurusuna yapıştırabilirsiniz) ve `workproof-report.json` dosyasını yazar (araçlar ve denetleme için). Kayıt, [langchain-ai/openwiki](https://github.com/langchain-ai/openwiki) deposunun `1e6d54c` sürümünde çalıştırıldı; çıktı [örnek rapor](docs/sample/openwiki-report.md) olarak depoda duruyor.

![Terminal kaydı: workproof raporu yazar, check hash ok der, verify tüm figürlerin yeniden hesaplandığını söyler, sonra iki paylaşım gösterilir](docs/demo.gif)

Bu bir verimlilik ölçütü değildir ve insanları sıralamaz. Hayatta kalanı ve dokunulanı ölçer; her figürün altında onun arkasındaki git komutunu ve neyi gösteremediğini yazar. Yalnızca JSON dosyası olan biri `workproof check` komutunu çalıştırıp dosyanın yazıldıktan sonra değiştirilip değiştirilmediğini öğrenebilir. Bu, deponun geçmişinin gerçek olduğunu kanıtlamaz ([tehdit modeli](docs/THREAT-MODEL.md)). Adaylar aracı çalıştırır; işe alan kişi için [İşe alanlar için](#i%CC%87%C5%9Fe-alanlar-i%C3%A7in) bölümüne bakın.

<p align="center">
  <img src="https://img.shields.io/npm/v/workproof?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/github/actions/workflow/status/Bubblegunn/workproof/ci.yml?style=flat-square&color=111111&label=ci" alt="ci">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT">
  <a href="https://doi.org/10.5281/zenodo.22394558"><img src="https://img.shields.io/badge/DOI-10.5281%2Fzenodo.22394558-111111?style=flat-square" alt="DOI"></a>
  <a href="https://github.com/marketplace/actions/workproof-report"><img src="https://img.shields.io/badge/GitHub_Marketplace-workproof--report-111111?style=flat-square&logo=github" alt="GitHub Marketplace"></a>
  <a href="https://www.bestpractices.dev/projects/15493"><img src="https://img.shields.io/cii/level/15493?style=flat-square&color=111111&label=openssf%20best%20practices" alt="OpenSSF Best Practices"></a>
</p>

## Bu aracın farkı

git-fame ve gitinspector de git'ten kişi başına sayılar çıkarır. [docs/COMPARISON.md](docs/COMPARISON.md) ölçülmüş karşılaştırmayı içerir: her araç 2026-10-20 tarihinde aynı örnek depoda bir kez varsayılanlarıyla, bir kez elle ayarlanmış haliyle çalıştırıldı. Aşağıdakiler workproof'un önde olduğu ya da eşit olduğu satırlardır:

- Hayatta kalan satırlar: git-fame 4.2.1, `-w -M --ignore-revs-file` verildiğinde `git blame` ile eşleşiyor; workproof ise varsayılan olarak `.git-blame-ignore-revs` dosyasını okuyor. gitinspector v0.5.1 iki çalıştırmada da `git blame` ile eşleşmedi.
- Botlar: workproof saymadan önce bot commit'lerini çıkarır. git-fame 4.2.1 iki çalıştırmada da bir botu yazar olarak listeledi.
- E-posta adresleri: workproof'un varsayılan çıktısında hiç e-posta adresi yok. gitinspector v0.5.1 ve onefetch 3.1.0 birer tane yazıyor.
- Raporu denetleme: workproof kendi yazdığı bir raporu denetlemek için `check`, `verify`, `attest` ve `countersign` komutlarına sahip. git-fame, gitinspector, git-who ve onefetch'in yardım metinlerinde verify ya da attest komutu geçmiyor.

Workproof'un geride kaldığı satırlar aynı sayfada: git alt komutu olarak çalışmak, CSV, HTML ya da XML yazmak, git-fame, git-who ve onefetch'e karşı hız, ve özel çalışmayı GitHub katkı grafiğine yansıtmak (contributions-importer'a karşı).

## Çalıştırma ne yazar

Kayıt aşağıdaki komutları gösterir. Komutlar herkese açık bir depoda çalışır, böylece herkes tekrarlayabilir. `--fingerprint-key` her makinede aynı hash'in çıkması için verilir; verilmezse araç rastgele bir anahtar üretir, bir kez yazdırır ve hiçbir yerde saklamaz, `verify` ise bu anahtara sonradan ihtiyaç duyar. `verify`'ın "all figures reproduce" satırından sonra yazdığı, neyi kanıtladığını ve neyi kanıtlamadığını anlatan iki paragraf burada yok; [docs/sample/transcript.txt](docs/sample/transcript.txt) dosyasında duruyor. Rapor [docs/sample/openwiki-report.md](docs/sample/openwiki-report.md) ve [docs/sample/openwiki-report.json](docs/sample/openwiki-report.json) olarak commit edildi. `scripts/make-sample.sh` ikisini yeniden üretir; bu sayfa ile örnek birbirinden ayrılırsa bir test başarısız olur.

```
$ npx workproof --author "Colin Francis" --sample 5 --fingerprint-key 9dc900a6227a1faaaa17d774565afbf3
openwiki: reading history...
openwiki: 369 commits read
openwiki: blaming files (1 in 5 sample)...
openwiki: blamed 123 of 547 files
wrote workproof-report.md and workproof-report.json in 1.0s

$ npx workproof check workproof-report.json
schema ok
hash ok f0fc23197ef76c471c06bccaa57e1e711440635a7e4af8634f5f711f7819a911

$ npx workproof verify workproof-report.json --fingerprint-key 9dc900a6227a1faaaa17d774565afbf3
schema ok
hash ok f0fc23197ef76c471c06bccaa57e1e711440635a7e4af8634f5f711f7819a911
openwiki: fingerprint ok
all figures reproduce
```

`check` için yalnızca JSON gerekir. `verify` için depo gerekir.

## Bir rapor neye benzer

openwiki deposunun `1e6d54c` sürümünde bir bakımcı için 6 Eylül 2026'da
`--author "Colin Francis" --sample 5` ile alınan gerçek çıktı; yollar ve e-postalar gizli
(varsayılanlar). Tam raporda her figürün altında git komutuyla `How:` ve
`What this cannot show:` satırları da vardır; burada yer için kesildi.

```
## openwiki

HEAD 1e6d54cdfeec · fingerprint a1b19a27aab4a577 · identities: Colin Francis

excluded 64 bot commits and 1 generated, vendored or lock file (2.6% of lines added)

### Tenure window
2026-07-06 to 2026-09-03 (60 days)

### Share of commits in tenure
71 of 235 non-merge commits, 30.2%

### Cadence
9 active weeks of 9, 7.9 commits per active week, longest streak 9 weeks
1 of 21 release tags in tenure

### Footprint
693 files touched
16 directories with a commit share at or above the threshold (paths hidden; run with --paths)
languages by lines added: TypeScript 81.4%, JSON 9.7%, Markdown 7.1%, JavaScript 1.6%, YAML 0.2%

### Test-file changes and documents created
393 of 657 test-file changes, 59.8%
101 documents created

### Files authored
455 of 555 files alive at HEAD, 82.0% (degree of authorship)

### Major-contributor components
major contributor in 59 of 65 directories (at least 5% of commits)

### Commit size
median 166 lines, 90th percentile 9,234, 6 commits over 10,000 lines

### Co-authored commits
119 commits by others naming the author in a Co-authored-by trailer

### Absence factor
4 authors cover half the commits; the author ranks 1 of 73 by commit count

### AI-assisted commits
1 commit declares an AI tool in a trailer, 1.4% of the author's commits

### Surviving lines at HEAD
23,317 of 33,038 surviving lines, 70.6% (files 123/547, sample 1 in 5)

### Survival by cohort
2026: 23,317 lines
```

İlk satırı ve iki payı birlikte okuyun. Altmış dört bot commit'i daha hiçbir şey
sayılmadan paydadan çıktı; bu, aynı kişinin eski sürümde %24,1 görünen commit payını
%30,2'e taşıdı. Penceresindeki insan commit'lerinin %30,2'ini ve hâlâ yaşayan satırların
%70,6'sını yazmış. Tek başına commit sayısı onu yetmiş üç katkıcıdan biri diye
adlandırırdı. Bu boşluk, iki yönde de, bir raporun birinin işi hakkında söyleyebileceği en
dürüst şeydir.

## ASCII olmayan isimler

Kimlik katlaması hangi commit'lerin size ait olduğuna karar verir; oradaki bir boşluk çirkin bir
görüntü değil, eksik bir figür demektir. Unicode 17.0'a bakılarak iki boşluk kapatıldı ve ikisi de
sayıları değiştirdi:

- `Weiß` ile `WEISS` tek kişidir. JavaScript'in `toLowerCase`'i Unicode'un basit harf katlamasıdır
  ve ß'ye dokunmaz; iki yazım hiç buluşmuyordu ve bir kişinin commit'lerinin yarısı bütün
  figürlerin dışında kalıyordu. Tam katlama ß'yi ss'ye eşler
  ([CaseFolding.txt](https://www.unicode.org/Public/UCD/latest/ucd/CaseFolding.txt), durum `F`)
  ve araç artık bunu yapıyor.
- Tam genişlikli Latin harfleriyle yazılan bir isim, ki Japonca ya da Korece bir klavyede mod
  değiştirmeden yazılan budur, ASCII ile yazılan aynı isimdir. Eşleştirme NFKC'ye normalleştirir;
  ﬁ bağlaması ve uyumluluk ideografları da bununla birlikte katlanır.

Türkçe noktalı ve noktasız i ile ayrışık aksanlar zaten katlanıyordu. Katlama yalnız eşleştirme
içindir; rapor her zaman git'in tuttuğu ismi yazar.

Görüntü ayrı bir konu. Arapça ya da İbranice bir isim, sade dil paragrafının ilk güçlü
karakteridir ve yalıtıcı olmadan bütün paragrafı sağdan sola çevirir: ardındaki İngilizce ters
döner, sayılar yanlış sırada görünür. Markdown raporunda isimler ve depo adları U+2068 ile U+2069
arasına alınıyor; [UAX #9](https://www.unicode.org/reports/tr9/) bu yalıtıcıları tam olarak bunun
için tanımlar. Görünmezler, yalnız güçlü sağdan sola karakter geçtiğinde eklenirler ve JSON'a hiç
yazılmazlar; yani rapor özeti değişmez ve bu değişiklikten önce yazılmış bir rapor hâlâ doğrulanır.

Üç şey bilerek böyle:

- Sayılar, insanın okuduğu her yerde `en-US` biçiminde yazılır; `12,345` her okuyucu için on iki
  bindir. Özet, sayıların hiç biçimlendirilmediği RFC 8785 kanonik JSON üzerinden alınır, yani bu
  seçim `workproof verify`'ı etkileyemez. Mesele belgedir: iki rapor yan yana okunmak için yazılır
  ve okuyucunun makinesine göre değişen bir binlik ayıracı bunu boşuna zorlaştırır.
- Haftalar ISO haftasıdır, pazartesi başlar. Dünyanın çoğu için yerel hafta bu değildir: en
  kalabalık yirmi ülkeden CLDR'ye göre yedisinde pazartesi, on birinde pazar, ikisinde cumartesi
  başlar; Node 24'te bunu `Intl.Locale.prototype.getWeekInfo` söyler. Cadence, bir kişinin etkin
  olduğu haftaları sayar ve bu figür ancak başka bir raporun yanında anlamlıdır, o yüzden
  okuyucunun tanımını değil her yerde aynı tanımı kullanır. Haftanın içindeki günler zaten yazarın
  kendi yerel tarihleridir; bir pazar commit'inin bu haftaya mı yoksa sonrakine mi düştüğüne o
  karar verir.
- `.mailmap` isimlerini bu araç değil git eşleştirir. git bu isimleri yalnız ASCII harfleri için
  büyük küçük harf farkını yok sayarak karşılaştırır; git 2.50.1 üzerinde doğrulandı:
  `josÉ Álvarez` yazılmış bir satır `JOSÉ ÁLVAREZ` imzalı bir commit ile eşleşiyor,
  `josé álvarez` yazılmış olan eşleşmiyor. Mümkün olan her yerde adresle eşleyin.

## Ne ölçer

Her figür git'ten gelir, başka hiçbir şeyden değil. Bot commit'leri ile üretilmiş, vendored,
kilit ve snapshot dosyaları hiçbir figür hesaplanmadan önce çıkarılır (bkz. Oyun ve yanlılık).

| figür | ne | neyi gösteremez |
|---|---|---|
| Görev penceresi | yazarın ilk ve son commit'i, ya da `--since/--until` | ilk commit'ten önceki ya da sonuncudan sonraki iş |
| Commit payı | penceredeki insan merge dışı commit'leri içinde yazarınkiler | neyin sağ kaldığı; bir yazım hatası ile bir alt sistem aynı sayılır |
| Tempo | aktif haftalar, aktif hafta başına commit, en uzun seri, penceredeki sürüm etiketleri ve yazarınkiler | bir commit'lik hafta ile kırk commit'lik hafta ikisi de aktif sayılır |
| Ayak izi | dokunulan dosyalar, commit payı eşiğin üstündeki dizinler, eklenen satıra göre diller | dışlama listelerinin kaçırdığı her şey yine sayılır |
| Test dosyası değişiklikleri ve oluşturulan dokümanlar | test dosyası değişikliklerinin payı; en eski commit'i yazara ait `.md`, `.mdx`, `.rst` dosyaları | test vakaları, kapsam ya da bir dokümanın kalitesi |
| Yazarı olunan dosyalar | HEAD'de yaşayan ve yazarın yazarlık derecesinin (Avelino ve ark.) en az 3,293 ve dosya maksimumunun %75'inin üstünde olduğu dosyalar | katsayılar başka sistemlerde uydurulmuştur; ilk yazarlık sonraki yeniden yazımlardan ağır basar |
| Ana katkıcı olunan bileşenler | yazarın commit'lerin en az %5'ine sahip olduğu dizinler (Bird ve ark.) | commit teması bir yazım hatası ile bir alt sistemi aynı görür |
| Commit büyüklüğü | commit başına eklenen artı silinen satırın medyanı ve 90. yüzdeliği; 10.000 satırı aşan commit'ler | büyüklük değer değildir; import'lar ve biçimlendirmeler 90. yüzdeliği belirler |
| Ortak yazarlı commit'ler | başkalarının `Co-authored-by` satırında yazarı andığı commit'ler | bu satırları merge eden yazar; eksik ya da yanlış olabilir |
| Yokluk faktörü | commit'lerin yarısını kapsayan en küçük yazar kümesi (CHAOSS) ve yazarın sırası | birleştirilmemiş birden çok e-posta birden çok kişi sayılır |
| Yapay zeka destekli commit'ler | satırlarında ya da adında Claude, Cursor, Copilot, Codex, Gemini, ChatGPT, Aider, Devin ya da Windsurf beyan eden yazar commit'leri | eksik bir beyan, yardımsız yazıldığının kanıtı değildir |
| Hayatta kalan satırlar | HEAD'de yaşayan satırların payı; deterministik dosya örneği üzerinde tek `git blame -w -M` geçişi, `.git-blame-ignore-revs` dikkate alınır | liyakat; bilerek silinen kod kimseye sayılmaz |
| Yıla göre hayatta kalma | yazarın hayatta kalan satırları, onlara son dokunan commit'in yılına göre | yeni yıllar ölmek için daha az zaman bulmuştur |

## Doğrulama nasıl çalışır

Üç komut; okuyanın elinde olması gerekenlere göre artan sırada.

- `workproof check report.json` için yalnızca dosya gerekir. Belgeyi
  [schema/report.schema.json](schema/report.schema.json) ile doğrular ve hash'i yeniden
  hesaplar: parametreler ile figürlerin [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)
  kanonik JSON'u üzerinde sha256. Değiştirilmiş bir figür `hash mismatch: report says X,
  content hashes to Y` basar ve 1 ile çıkar. Git yok, ağ yok.
- `workproof verify report.json` için depo gerekir. Önce `check` çalıştırır, parmak izini
  karşılaştırır (`--fingerprint-key` ile; onsuz karşılaştırmayı atlar ve bunu söyler),
  HEAD'i karşılaştırır, sonra her figürü yeniden hesaplayıp farkları basar. Başka bir depodan
  gelen rapor parmak izinde durur. HEAD rapordan beri ilerlediyse bunu söyler ve hangi
  figürlerin değiştiğini gösterir.
- `workproof attest report.json`, konusu rapor hash'i olan bir [in-toto](https://in-toto.io)
  v1 beyanı olarak `report.intoto.json` yazar; beyanın yüklemi araç sürümünü, parametreleri,
  HEAD'i, anahtarlı parmak izini, git sürümünü ve dışlama sayılarını taşır, başka hiçbir
  şeyi: figür yok, remote yok, yol yok, e-posta yok. `--local ~/.ssh/id_ed25519` beyanı
  `ssh-keygen -Y sign` ile `workproof` ad alanında imzalar; ayrık imzayı ve bir DSSE zarfını
  yazar. Açık anahtarınıza sahip herkes şöyle kontrol eder:

  ```
  ssh-keygen -Y verify -f allowed_signers -I you@example.com -n workproof \
    -s workproof-report.intoto.json.sig < workproof-report.intoto.json
  ```

  `allowed_signers` tek satırdır, `you@example.com ssh-ed25519 AAAA...`; anahtar,
  GitHub'ın `https://github.com/<you>.keys` adresinde sunduğu anahtardır.

GitHub Action'da `attest: "true"` aynı beyanı [Sigstore](https://www.sigstore.dev) ile
anahtarsız imzalar: cosign SHA ile sabitlenmiş bir action'dan kurulur ve
`cosign attest-blob`, `workproof-report.sigstore.json` dosyasını yazar. Okuyan şöyle
doğrular:

```
cosign verify-blob-attestation workproof-report.json \
  --bundle workproof-report.sigstore.json \
  --type https://github.com/Bubblegunn/workproof/blob/main/docs/attestation-v1.md \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/<owner>/<repo>/'
```

Predicate türü [docs/attestation-v1.md](docs/attestation-v1.md) içinde anlatılır. 0.6.0'dan önce
yazılan paketler eski türü, `https://workproof.dev/attestation/v1` değerini taşır; onları
doğrulamak için `--type` olarak bu değeri verin.

Bunun kanıtladığı: bu JSON tam olarak o depoda, o commit'te çalışan bir iş akışı tarafından
üretildi ve o zamandan beri değişmedi. Kanıtlamadığı: figürlerin doğru olduğu (bunun için
`verify` çalıştırın) ya da iş akışının hangi depoyu çektiği konusunda dürüst olduğu. Açmadan
önce iki uyarı. Fulcio sertifikası iş akışının çalıştığı depoyu adıyla anar ve Rekor
şeffaflık günlüğü herkese açık ve kalıcıdır. Özel kod için belgelenen kalıp, raporu tutan ve
attest adımını çalıştıran küçük bir açık depodur; böylece özel deponun adı günlüğe hiç
ulaşmaz.

## Gizlilik

- Kod içeriği, asla. Araç `git log --numstat` ve `git blame` okur ve sayılar üretir.
- Varsayılan olarak dosya yolu yok. `--paths`, yapılandırılan `--depth` (varsayılan 2)
  derinliğinde dizin adları ekler, dosya asla.
- Varsayılan olarak e-posta adresi yok. `--emails` ekler; onsuz, yazdığınız `--author` bile
  saklanan parametrelerde `(email hidden)` ile değiştirilir. GitHub noreply adresleri
  (`<id>+<login>@users.noreply.github.com`) bayrak olsun olmasın asla yazılmaz, çünkü
  kullanıcı adı adresin içindedir.
- Konu dışı kişilerin adları asla yazılmaz. Yokluk faktörü figürü yalnızca sayı taşır.
- Parmak izi, rapor başına üretilen 16 baytlık bir anahtarla `HMAC-SHA256(anahtar, kök commit
  + remote)` değeridir. Anahtar bir kez basılır ve hiçbir yerde saklanmaz; böylece açık bir
  depo parmak izinden geri bulunamaz. Aynı deponun raporlarında anahtarı yeniden kullanmak
  için `--fingerprint-key` verin.
- İsteğe bağlı anlatı (`--narrate`) figürleri, yalnızca figürleri, seçtiğiniz bir model uç
  noktasına gönderir (`WORKPROOF_API_URL`, `WORKPROOF_API_KEY`, `WORKPROOF_MODEL`; OpenAI
  uyumlu ya da Anthropic). Paragraf "Generated narrative (not verified)" başlığı altına
  eklenir ve hash'in dışındadır.

## Seçenekler

```
workproof [options] [--repo <dir>]...
workproof check <report.json>
workproof verify <report.json> [--repo <dir>]... [--fingerprint-key <hex>]
workproof attest <report.json> [--local <ssh-key>]

--author <email|name>   identity to report on (repeatable; default: git config user.email)
--repo <dir>            repository to analyse (repeatable; several produce one combined report)
--since / --until       override the tenure window
--sample <n>            blame every n-th file (default: 1; 7 for very large repositories)
--seed <text>           salt for the blame file sample
--exclude <glob>        also drop files matching the glob (repeatable)
--no-exclusions         count bot commits and generated, vendored, lock and snapshot files
--copies                pass -C to git blame so copied lines follow their origin
--ignore-revs-file <f>  blame ignore-revs file (default: .git-blame-ignore-revs at the root)
--fingerprint-key <hex> reuse a fingerprint key so two reports of one repository match
--max-commits <n>       read only the newest n commits (escape hatch for enormous histories)
--depth <n>             directory depth for ownership (default: 2)
--paths                 include directory paths
--emails                include author emails
--narrate               append a model-written paragraph
--badge                 also write <out>.badge.json, a shields.io endpoint document
--out <basename>        output basename (default: workproof-report)
--format <mode>         write markdown, json, or both (default: both); json prints to stdout
--json                  same as --format json
```

Depodaki bir `.mailmap`, bir yazarın birden çok adresini birleştirir. Geçmiş okunurken ve
dosyalar blame'lenirken ilerleme satırları stderr'e gider. Her git çağrısı
`diff.renames=true`, `diff.algorithm=myers`, `diff.indentHeuristic=true` ve
`core.autocrlf=false` ile çalışır; rapor git sürümünü, blame bayraklarını, ignore-revs
dosyasını ve tohumu kaydeder. Böylece farklı varsayılanlara sahip iki makine aynı sonucu verir
ve `verify` bir ortam farkını bir düzenlemeden ayırt edebilir.

## Rozet

`--badge`, raporun yanına [shields.io endpoint biçiminde](https://shields.io/badges/endpoint-badge)
`workproof-report.badge.json` yazar:

```json
{ "schemaVersion": 1, "label": "workproof", "message": "70.6% surviving lines · 60 days", "color": "1f3fbf" }
```

Açık bir depoya (portfolyonuz, bir gist) commit'leyin ve shields'ı ham URL'ye yönlendirin:

```
![workproof](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/<you>/<repo>/main/workproof-report.badge.json&style=flat-square)
```

Rozet bir iddiadır, kanıt değil. JSON raporu yanında tutun; okuyanın doğruladığı rapordur,
rozet yalnızca onu bulma yoludur.

## GitHub Action

Depo, bir checkout üzerinde workproof'u çalıştıran, `check` yapan, in-toto beyanını yazan ve
pull request'e başlık figürleriyle tek bir yapışkan yorum bırakan bir composite action
içerir. `fetch-depth: 0` zorunludur: sığ (shallow) bir klonda mevcut en eski commit, kendisinden
eski her satırın sahibi sayılır; bu yüzden workproof (CLI, `verify` ve action) rapor yazmak
yerine `git fetch --unshallow` komutunu adıyla veren bir hatayla durur. `author`
zorunludur, çünkü bir GitHub kullanıcı adı commit kimliklerine güvenilir biçimde eşlenmez.

```yaml
name: workproof
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
  id-token: write # only for attest: "true"
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: Bubblegunn/workproof@v0
        with:
          author: ada@example.com
          sample: "1"
          attest: "false"
```

`@v0`, bakımcının her 0.x sürümünde en yeniye taşıdığı hareketli bir etikettir; action'ın
altınızda hiç değişmemesini istiyorsanız bir commit SHA'sına sabitleyin. Girdiler kabuğa
ortam değişkenleriyle ulaşır, betiğe hiçbir zaman yerleştirilmez. Yorum sonraki push'larda
yerinde güncellenir (bir işaret taşır) ve `workproof-report.json`, `.intoto.json` ile
`.predicate.json` bir `upload-artifact` adımı için çalışma alanında kalır. Yalnızca dosyaları
üretmek için `comment: "false"` verin.

Action iki çıktı tanımlar: `report`, JSON raporunun yolu, ve `bundle`, `attest: "true"`
olduğunda Sigstore paketinin yolu (aksi halde boş). Okumak için adıma bir `id` verin:

```yaml
      - uses: Bubblegunn/workproof@v0
        id: workproof
        with:
          author: ada@example.com
      - run: npx workproof check "$REPORT"
        env:
          REPORT: ${{ steps.workproof.outputs.report }}
```

`package` girdisi, kayıt defterindeki `workproof@<version>` yerine yerel bir npm pack
arşivini çalıştırır. Bu deponun CI'ı, action'ı test edilen commit'ten derlenen paketle
çalıştırmak için kullanır; yayımlanmış sürümü almak için boş bırakın.

## Oyun ve yanlılık

Kısmen oyunlanabilir; rapor, oyunun görünmesi için tasarlandı. Bir sayıya güvenmeden önce
okuyanın bilmesi gereken on üç şey.

1. Commit spam'i commit payını ve tempoyu oynatır, başka bir şeyi değil. Hayatta kalan
   satırlar HEAD'deki `git blame`'den gelir; bin boş commit sıfır hayatta kalan satır ekler
   ve iki pay yan yana basılır.
2. Bir kütüphaneyi vendor'lamak eklenen satırları şişirir. Vendored dizinler, kilit
   dosyaları, snapshot'lar, küçültülmüş varlıklar ve üretilmiş çıktılar yerleşik listelerle ve
   `.gitattributes` içindeki `linguist-generated` ya da `linguist-vendored` ile dışlanır;
   rapor ne kadarının dışlandığını basar. Listelerin kaçırdığı yine sayılır; `--exclude` onu
   kapsar ve glob parametrelere kaydedilir.
3. Bot commit'leri (`dependabot[bot]`, `renovate[bot]`, GitHub uygulama kimlikleri) her
   paydadan çıkar. İnsan gibi adı olan bir bot tespit edilmez; sezgisel yöntem yoktur.
4. Bir biçimlendirme commit'i, `.git-blame-ignore-revs` içinde listelenmediyse dokunduğu her
   satırı alır. Rapor hangi dosyanın kullanıldığını ya da hiç kullanılmadığını söyler.
5. `--since`, `--until`, `--sample`, `--seed` ve `--exclude` hepsi göze hoş görünen bir
   pencere ya da örnek seçme yoludur. Her biri parametrelerde saklanır ve hash'lenir.
6. Yazarlığı değiştirmek için geçmişi yeniden yazmak kök commit'i ya da HEAD'i değiştirir;
   eski bir rapordaki parmak izi ve HEAD eşleşmez olur.
7. Yazarlık derecesi başka sistemlerde uydurulmuş katsayılar kullanır. İlk yazarlık sonraki
   yeniden yazımlardan ağır basar; başkasının sıfırdan yeniden yazdığı bir dosya ilk yazarında
   kalabilir.
8. `Co-authored-by` satırlarını merge eden yazar. Eksik, yanlış ya da bir squash-merge
   arayüzünün eklediği olabilir; satırsız eşli çalışma görünmezdir.
9. Yapay zeka destekli demek, bir satır ya da yazar adı öyle demiş demektir. Satırın
   yokluğu yardımsız yazıldığının kanıtı değildir; blame her satırı insana yazar, dolayısıyla
   yazarlık artık anlamayı ima etmez. Bu commit'ler başka hiçbir figürden dışlanmaz.
10. Yokluk faktörü e-posta adresi sayar. Birleştirilmemiş birden çok adresi olan bir yazar
    birden çok kişi sayılır; bir `.mailmap` ekleyin.
11. Oluşturulan dokümanlar, en eski commit'i yazara ait dosyaları sayar. Tek satırlık bir
    README ile bir tasarım belgesi aynı sayılır.
12. Test dosyası değişiklikleri, test yollarıyla eşleşen dosya değişiklikleridir; test
    vakası, assertion ya da kapsam değildir.
13. Doğrulayıcı aynı depoya karşı çalışır. Yeniden üretilemeyen bir rapor, hiç rapor
    olmamasından kötüdür; aracın dayandığı teşvik budur. Hiçbir figürün yakalamadığı:
    gerçekten büyük ama düşük değerli bir katkı. Referanslar bunun içindir.

## Adaylar için

Gurur duyduğunuz ve gösteremediğiniz her depoda çalıştırın. Markdown'ı portfolyonuza, zaten
yazacağınız cümlenin ("frontend'i ben yaptım") yanına koyun ve sayılar cümleyi taşısın. JSON'u
ve parmak izi anahtarını saklayın; inceleyenin doğruladığı JSON'dur.

## İşe alanlar için

JSON'u isteyin. `npx workproof check` bir saniyede düzenlenip düzenlenmediğini söyler. Sonra
adayın eski şirketinden birinin üzerinde `npx workproof verify` çalıştırmasını isteyin. Tablo
ya yeniden üretilir ya üretilmez. Depo ilerlediyse araç hangi figürlerin değiştiğini ve bunun
neden beklendiğini söyler.

## Vize ve göç kanıtı için

workproof, en güçlü işin özel depolarda olduğu ve "bana güven"in kanıt sayılmadığı bir
Birleşik Krallık Global Talent başvurusu için yapıldı. Bir rapor, yöntemi ekli bir ölçümdür,
bir tavsiye değil; orada bulunmuş insanların mektuplarıyla ve okuyan depoya ulaşamıyorsa bir
attestation ile birlikte kullanın.

## Bunu yapmaz

Hayatta kalmayı ve etkinliği ölçer; kaliteyi, incelemeyi, tasarımı ya da mentorluğu değil.
İnsanları sıralamaz. Referansların yerine geçmez. Hukuki bir belge değildir.

## Nereden geliyor

Yöntem
[How to show engineering ownership when the repositories are private](https://efe-genc-portfolio.vercel.app/writing/showing-ownership-private-repositories/)
yazısında anlatılıyor. Örnekleyici ve glob yardımcıları workproof'un tek bağımlılığı olan
[surviving-lines](https://github.com/Bubblegunn/surviving-lines) paketinden gelir. Yazarlık
derecesi Avelino, Hora ve Valente (2016), ana katkıcı Bird ve ark. (2011), yokluk faktörü
CHAOSS Contributor Absence Factor tanımını izler.

## Atıf

Her sürüm Zenodo'da bir DOI ile arşivleniyor, böylece bir makale ya da rapor tam olarak
çalıştırdığı koda işaret edebiliyor.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22394558.svg)](https://doi.org/10.5281/zenodo.22394558)

Bu **kavram** DOI'si: her zaman en yeni sürüme çözümlenir. Çalıştırdığınız sürümün kendisini
atıflamak için o sayfayı açıp yan çubuktan sürümü seçin ve orada yazan DOI'yi kullanın.
Depodaki `CITATION.cff` aynı tanımlayıcıyı taşıyor, bu yüzden GitHub'ın "Cite this repository"
düğmesi elle kopyalama olmadan doğru BibTeX ve APA üretiyor.

## Geliştirme

```
npm ci
npm test        # tsc build, then node:test over the compiled tests (fixture repositories built in a temp dir)
```

MIT.

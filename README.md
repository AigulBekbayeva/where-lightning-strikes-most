# Where Lightning Strikes Most

**Где на Земле чаще всего происходят грозы? Как связаны молнии, влажность, рельеф и тропические климатические зоны?**

Интерактивная карта грозовой активности Земли для GitHub Pages.
Данные: NASA LIS/OTD, ERA5.

Две версии страницы: русская — `index.html`, английская — `en.html` (переключатель в правом верхнем углу панели, вид карты сохраняется).

*English:* an interactive map of global thunderstorm activity from NASA LIS/OTD lightning climatology and ERA5 reanalysis. English page: `en.html`.

## Что на карте

| Слой | Что показывает | Источник |
|---|---|---|
| Молнии | средняя плотность вспышек, вспышек/км²/год, 1995–2014 | NASA LIS/OTD HRFC v2.3.2015, 0.5° |
| Водяной пар | интегральный водяной пар в столбе атмосферы (TCWV), мм | ERA5 |
| Неустойчивость (CAPE) | конвективная доступная потенциальная энергия, Дж/кг | ERA5 |
| Осадки | годовая сумма, мм | ERA5 |
| Рельеф суши | высота поверхности, м (из геопотенциала) | ERA5 |
| Зоны Кёппена | Af, Am, Aw, BW, BS, C, D, E — рассчитаны из температуры и осадков ERA5 (критерии Peel et al., 2007) | ERA5 |

Поверх любого слоя можно включить **контур гроз** с настраиваемым порогом — так видно, совпадают ли грозовые районы с влажностью, горами или тропическими зонами.
Отдельно отмечены **50 горячих точек** из статьи Albrecht et al. (2016): по 10 сильнейших на каждом континенте, номерами — мировая десятка.

В боковой панели — три графика, которые считаются прямо в браузере из тех же данных:
молнии по широтам (суша и океан), молнии в зависимости от водяного пара / CAPE / осадков / высоты и молнии по зонам Кёппена.
У каждого графика есть табличный вид.

Наведите курсор на карту — в углу появятся значения всех слоёв в этой ячейке. Ссылка в адресной строке сохраняет слой и положение карты.

## Структура

```
index.html              страница (русский)
en.html                 страница (English)
css/style.css           оформление (светлая и тёмная тема)
js/app.js               карта (Leaflet), отрисовка сетки, графики
data/hotspots.json      горячие точки (Albrecht et al., 2016)
data/grid/              слои сетки — создаются скриптом, см. ниже
scripts/prepare_data.py загрузка и обработка LIS/OTD + ERA5
.github/workflows/build-data.yml  сборка данных в GitHub Actions
```

## Запуск

### 1. Опубликовать сайт

1. Создайте репозиторий и загрузите в него файлы.
2. **Settings → Pages → Build and deployment → Deploy from a branch**, ветка `main`, папка `/ (root)`.

Пока слои не собраны, на карте видны только горячие точки, а в панели — подсказка, как собрать данные.

> **Важно:** папка `.github` и файлы `.gitignore`, `.nojekyll` начинаются с точки, поэтому macOS и Windows их скрывают. При загрузке через браузер («Add file → Upload files») они не попадают в репозиторий, и действие **Build data** не появится. Создайте workflow вручную: **Add file → Create new file**, в поле имени введите `.github/workflows/build-data.yml` (слэши сами создадут папки), вставьте содержимое файла из архива и нажмите **Commit changes**. Скрытые файлы показываются в Finder по ⌘ + Shift + `.`, а в Проводнике Windows — через «Вид → Скрытые элементы».

### 2. Собрать данные

**Нужен ключ Copernicus CDS** (бесплатно):

1. Зарегистрируйтесь на <https://cds.climate.copernicus.eu>.
2. Откройте страницу набора [ERA5 monthly averaged data on single levels](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels-monthly-means) → вкладка *Download* → примите лицензию внизу страницы (без этого API вернёт ошибку).
3. Скопируйте персональный токен из профиля.

Климатология молний сначала скачивается с открытого ERDDAP-сервера APDRC (Гавайский университет) без регистрации. Этот сервер иногда не отвечает раннерам GitHub, поэтому **рекомендуем сразу завести бесплатную учётную запись NASA Earthdata** — <https://urs.earthdata.nasa.gov> — и добавить её в секреты: тогда скрипт возьмёт файл напрямую из архива NASA GHRC DAAC.

**Вариант А — GitHub Actions** (ничего не нужно ставить):

1. **Settings → Secrets and variables → Actions → New repository secret**: `CDSAPI_KEY` = ваш токен,
   `EARTHDATA_USERNAME` и `EARTHDATA_PASSWORD` = логин и пароль NASA Earthdata.
2. **Actions → Build data → Run workflow.**
3. Скрипт скачает данные, соберёт `data/grid/` и закоммитит его. Запрос к CDS может постоять в очереди — от нескольких минут до пары часов.

   Скачанные файлы кешируются между запусками: если что-то упало, повторный запуск не будет заново ждать очередь CDS.
   Чтобы быстро проверить только загрузку молний, поставьте галочку **lightning_only** при запуске (займёт пару минут).
   Шаг **Check data sources** в логе показывает, какие серверы отвечают и заданы ли секреты.

**Вариант Б — локально:**

```bash
pip install -r scripts/requirements.txt
printf "url: https://cds.climate.copernicus.eu/api\nkey: <ВАШ_ТОКЕН>\n" > ~/.cdsapirc
python scripts/prepare_data.py            # период ERA5 по умолчанию 1995–2014
python -m http.server                      # открыть http://localhost:8000
git add data/grid && git commit -m "Add data layers" && git push
```

Полезные флаги: `--years 1998-2013` (период ERA5), `--native` (качать ERA5 на исходной сетке 0.25°, если CDS не принимает параметр `grid`), `--skip-download` (только обработка уже скачанного из `.cache/`).

Итог — семь файлов по ~0.5 МБ (`frd`, `tcwv`, `cape`, `precip`, `elev`, `land`, `koppen`) и `meta.json`.

## Как обрабатываются данные

- Все поля приводятся к одной сетке 0.5°: центры ячеек от 89.75° с. ш. до 89.75° ю. ш. и от 179.75° з. д. до 179.75° в. д. — это сетка HRFC.
- Для ERA5 из среднемесячных полей строится климатология по 12 месяцам, затем считаются годовые средние (TCWV, CAPE) и суммы (осадки).
- Зоны Кёппена — основные классы по Peel et al. (2007): сначала полярные (самый тёплый месяц < 10 °C), затем засушливые B, затем A / C / D по температуре самого холодного месяца (18 °C и 0 °C). Тропические делятся на Af / Am / Aw по осадкам самого сухого месяца.
- Слои хранятся как `uint16` с линейным масштабом (`value = offset + q × scale`, 65535 — нет данных); параметры в `meta.json`.
- На странице сетка перепроецируется в Web Mercator на `<canvas>` и кладётся поверх подложки. Подложки бесплатные и без ключа: Esri World Dark Gray Canvas (по умолчанию, с отдельным слоем подписей) и ночные огни NASA GIBS VIIRS City Lights 2012 — переключаются в правом верхнем углу карты.
- Средние на графиках взвешены по cos(широты), чтобы ячейки у полюсов не перевешивали.

## Ограничения

- LIS летал только до ~38° широты, поэтому в средних широтах данные HRFC основаны на более коротком ряду OTD и менее надёжны (Cecil et al., 2014).
- Горячие точки посчитаны по LIS на сетке 0.1°, а карта — на 0.5°, поэтому пик Маракайбо (232 вспышки/км²/год) в ячейке карты сглажен.
- Зоны Кёппена по ERA5 на 0.5° — упрощённая версия; для детальных работ лучше карта Beck et al. (2018, 1 км).

## Источники

- Cecil D. J., Buechler D. E., Blakeslee R. J. (2014). *Gridded lightning climatology from TRMM-LIS and OTD: Dataset description.* Atmospheric Research 135–136, 404–414. [doi:10.1016/j.atmosres.2012.06.028](https://doi.org/10.1016/j.atmosres.2012.06.028)
- NASA GHRC DAAC. *LIS/OTD 0.5 Degree High Resolution Full Climatology (HRFC) V2.3.2015.* [doi:10.5067/LIS/LIS-OTD/DATA302](https://doi.org/10.5067/LIS/LIS-OTD/DATA302)
- Hersbach H. et al. ERA5 monthly averaged data on single levels from 1940 to present. Copernicus Climate Change Service (C3S) Climate Data Store. [doi:10.24381/cds.f17050d7](https://doi.org/10.24381/cds.f17050d7)
- Albrecht R. I. et al. (2016). *Where Are the Lightning Hotspots on Earth?* BAMS 97(11), 2051–2068. [doi:10.1175/BAMS-D-14-00193.1](https://doi.org/10.1175/BAMS-D-14-00193.1)
- Peel M. C., Finlayson B. L., McMahon T. A. (2007). *Updated world map of the Köppen-Geiger climate classification.* HESS 11, 1633–1644. [doi:10.5194/hess-11-1633-2007](https://doi.org/10.5194/hess-11-1633-2007)

Подложки: © Esri (Esri, HERE, Garmin, © участники OpenStreetMap); NASA GIBS. Код — MIT.
Содержит модифицированные данные Copernicus Climate Change Service.

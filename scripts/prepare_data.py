#!/usr/bin/env python3
"""
Подготовка данных для карты «Where Lightning Strikes Most».

Что делает скрипт
-----------------
1. Скачивает климатологию молний NASA LIS/OTD HRFC v2.3.2015 (0.5°, 1995–2014,
   вспышек на км² в год). Основной источник — открытый ERDDAP-сервер APDRC
   (без регистрации); запасной — NASA Earthdata (GHRC DAAC) через earthaccess.
2. Скачивает среднемесячные поля ERA5 (Copernicus CDS) за тот же период:
   температура 2 м, осадки, интегральный водяной пар (TCWV), CAPE,
   геопотенциал поверхности (→ высота рельефа) и маска суша/море.
3. Приводит всё к одной сетке 0.5° (центры ячеек, как у HRFC), считает
   климатические зоны Кёппена из температуры и осадков ERA5 и пишет
   компактные бинарные слои для браузера в data/grid/.

Запуск
------
    pip install -r scripts/requirements.txt
    # ключ CDS: https://cds.climate.copernicus.eu/how-to-api  (файл ~/.cdsapirc
    # или переменные CDSAPI_URL / CDSAPI_KEY)
    python scripts/prepare_data.py

Флаги:
    --cache DIR        где хранить скачанные NetCDF (по умолчанию .cache/)
    --out DIR          куда писать слои (по умолчанию data/grid/)
    --years 1995-2014  период осреднения ERA5
    --native           не просить CDS интерполировать ERA5 на 0.5° (качать 0.25°)
    --skip-download    только обработка уже скачанных файлов из --cache
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import xarray as xr

# ---------------------------------------------------------------------------
# Целевая сетка: центры ячеек 0.5°, строка 0 — север, столбец 0 — 179.75° з.д.
# ---------------------------------------------------------------------------
STEP = 0.5
NLAT, NLON = 360, 720
LATS = 89.75 - STEP * np.arange(NLAT)
LONS = -179.75 + STEP * np.arange(NLON)

ERDDAP_DATASET = "hawaii_soest_9656_a274_105c"
ERDDAP_BASE = f"https://apdrc.soest.hawaii.edu/erddap/griddap/{ERDDAP_DATASET}.nc"
ERDDAP_QUERY = "hrfc_com_fr[0][0][(-89.75):1:(89.75)][(-179.75):1:(179.75)]"

ERA5_DATASET = "reanalysis-era5-single-levels-monthly-means"
ERA5_MONTHLY = {
    "t2m": "2m_temperature",
    "tp": "total_precipitation",
    "tcwv": "total_column_water_vapour",
    "cape": "convective_available_potential_energy",
}
ERA5_STATIC = {
    "z": "geopotential",
    "lsm": "land_sea_mask",
}
DAYS_IN_MONTH = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])

# Кёппен: коды, которые понимает браузер (0 = океан / нет данных)
KOPPEN = {
    1: ("Af", "Тропический влажный"),
    2: ("Am", "Тропический муссонный"),
    3: ("Aw", "Тропическая саванна"),
    4: ("BW", "Пустыня"),
    5: ("BS", "Степь, полупустыня"),
    6: ("C", "Умеренный"),
    7: ("D", "Континентальный"),
    8: ("E", "Полярный, высокогорный"),
}


def log(msg: str) -> None:
    print(f"[{dt.datetime.now():%H:%M:%S}] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Загрузка
# ---------------------------------------------------------------------------
def download_lightning(cache: Path) -> Path:
    target = cache / "lisotd_hrfc.nc"
    if target.exists():
        log(f"LIS/OTD HRFC уже скачан: {target}")
        return target

    url = ERDDAP_BASE + "?" + urllib.parse.quote(ERDDAP_QUERY, safe="():")
    log(f"Скачиваю LIS/OTD HRFC с APDRC ERDDAP …\n    {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "lightning-map-prep/1.0"})
        with urllib.request.urlopen(req, timeout=300) as r, open(target, "wb") as f:
            f.write(r.read())
        return target
    except Exception as e:  # noqa: BLE001
        log(f"ERDDAP недоступен ({e}). Пробую NASA Earthdata (нужны EARTHDATA_USERNAME/PASSWORD или ~/.netrc).")
        if target.exists():
            target.unlink()

    import earthaccess  # noqa: PLC0415

    earthaccess.login(strategy="environment" if os.getenv("EARTHDATA_USERNAME") else "netrc")
    results = earthaccess.search_data(short_name="lohrfc", version="2.3.2015")
    if not results:
        sys.exit("Не нашёл коллекцию lohrfc в CMR.")
    files = earthaccess.download(results, str(cache / "ghrc"))
    nc = [Path(p) for p in files if str(p).endswith((".nc", ".nc4"))]
    if not nc:
        sys.exit(f"В выдаче GHRC нет NetCDF: {files}")
    nc[0].rename(target)
    return target


def download_era5(cache: Path, years: list[int], native: bool) -> None:
    import cdsapi  # noqa: PLC0415

    client = cdsapi.Client()
    base = {
        "product_type": ["monthly_averaged_reanalysis"],
        "time": ["00:00"],
        "data_format": "netcdf",
        "download_format": "unarchived",
    }
    if not native:
        base["grid"] = [STEP, STEP]

    for short, name in ERA5_MONTHLY.items():
        target = cache / f"era5_{short}.nc"
        if target.exists():
            log(f"ERA5 {name} уже скачан")
            continue
        log(f"Запрашиваю ERA5 {name} за {years[0]}–{years[-1]} (CDS может держать запрос в очереди) …")
        req = dict(base, variable=[name], year=[str(y) for y in years],
                   month=[f"{m:02d}" for m in range(1, 13)])
        client.retrieve(ERA5_DATASET, req, str(target))

    for short, name in ERA5_STATIC.items():
        target = cache / f"era5_{short}.nc"
        if target.exists():
            log(f"ERA5 {name} уже скачан")
            continue
        log(f"Запрашиваю ERA5 {name} (постоянное поле) …")
        req = dict(base, variable=[name], year=[str(years[0])], month=["01"])
        client.retrieve(ERA5_DATASET, req, str(target))


# ---------------------------------------------------------------------------
# Чтение и приведение к сетке
# ---------------------------------------------------------------------------
def _coord(ds: xr.Dataset | xr.DataArray, *names: str) -> str:
    for n in list(ds.coords) + list(ds.dims):
        if n.lower() in names:
            return n
    raise KeyError(f"нет координаты из {names}; есть {list(ds.coords)}")


def _main_var(ds: xr.Dataset, prefer: str | None = None) -> xr.DataArray:
    skip = {"number", "expver", "time_bnds", "lat_bnds", "lon_bnds"}
    names = [v for v in ds.data_vars if v not in skip and ds[v].ndim >= 2]
    if prefer:
        for v in names:
            if v.lower() == prefer.lower():
                return ds[v]
    if not names:
        raise KeyError(f"в файле нет полей данных: {list(ds.data_vars)}")
    return ds[names[0]]


def to_target_grid(da: xr.DataArray) -> xr.DataArray:
    """Любая регулярная lat/lon сетка → центры 0.5° (LATS, LONS), долгота −180…180."""
    lat, lon = _coord(da, "latitude", "lat"), _coord(da, "longitude", "lon")
    da = da.rename({lat: "lat", lon: "lon"})
    da = da.assign_coords(lon=((da.lon + 180) % 360) - 180).sortby("lon").sortby("lat")
    # циклическое продолжение по долготе, чтобы интерполяция не теряла край
    left = da.isel(lon=slice(-2, None)).assign_coords(lon=lambda d: d.lon - 360)
    right = da.isel(lon=slice(0, 2)).assign_coords(lon=lambda d: d.lon + 360)
    da = xr.concat([left, da, right], dim="lon")
    out = da.interp(lat=LATS, lon=LONS, method="linear")
    return out.transpose(..., "lat", "lon")


def read_lightning(path: Path) -> np.ndarray:
    ds = xr.open_dataset(path)
    da = _main_var(ds, prefer="hrfc_com_fr")
    for d in list(da.dims):
        if d.lower() not in ("lat", "latitude", "lon", "longitude") and da.sizes[d] == 1:
            da = da.isel({d: 0})
    try:
        lat, lon = _coord(da, "latitude", "lat"), _coord(da, "longitude", "lon")
        da = da.rename({lat: "lat", lon: "lon"}).sortby("lat", ascending=False).sortby("lon")
        arr = da.values.astype("float64")
    except KeyError:
        # файл GHRC без координат: считаем порядок (lat −90→90, lon −180→180)
        arr = np.asarray(da.values, dtype="float64")
        if arr.shape == (NLON, NLAT):
            arr = arr.T
        arr = arr[::-1, :]
    if arr.shape != (NLAT, NLON):
        sys.exit(f"Неожиданная форма HRFC: {arr.shape}")
    arr = np.nan_to_num(arr, nan=0.0)
    arr[arr < 0] = 0

    # Проверка ориентации: Пакистан (34° с.ш.) — горячая точка, а 34° ю.ш. там океан
    i_n, i_s, j = _idx(34.25), _idx(-34.25), _jdx(72.25)
    if arr[i_s, j] > arr[i_n, j]:
        log("⚠ похоже, широты перевёрнуты — переворачиваю")
        arr = arr[::-1, :]
    return arr


def _idx(lat: float) -> int:
    return int(np.clip(np.floor((90 - lat) / STEP), 0, NLAT - 1))


def _jdx(lon: float) -> int:
    return int(np.clip(np.floor((lon + 180) / STEP), 0, NLON - 1))


def read_era5_monthly(path: Path, short: str) -> np.ndarray:
    """Возвращает климатологию по месяцам: массив (12, NLAT, NLON)."""
    ds = xr.open_dataset(path)
    da = _main_var(ds, prefer=short)
    if "expver" in da.dims:
        da = da.max("expver")
    tname = _coord(da, "valid_time", "time")
    clim = da.groupby(f"{tname}.month").mean(tname)
    clim = to_target_grid(clim)
    return clim.transpose("month", "lat", "lon").values.astype("float64")


def read_era5_static(path: Path, short: str) -> np.ndarray:
    ds = xr.open_dataset(path)
    da = _main_var(ds, prefer=short)
    for d in list(da.dims):
        if d not in (_coord(da, "latitude", "lat"), _coord(da, "longitude", "lon")):
            da = da.isel({d: 0})
    return to_target_grid(da).values.astype("float64")


# ---------------------------------------------------------------------------
# Климатические зоны Кёппена (основные классы, критерии Peel et al., 2007)
# ---------------------------------------------------------------------------
def koppen(t_c: np.ndarray, p_mm: np.ndarray, land: np.ndarray) -> np.ndarray:
    """t_c — (12, ny, nx) °C, p_mm — (12, ny, nx) мм/мес."""
    mat = t_c.mean(0)
    map_ = p_mm.sum(0)
    tcold, thot = t_c.min(0), t_c.max(0)
    pdry = p_mm.min(0)

    north = (LATS >= 0)[:, None]
    amj = np.zeros(12, bool)
    amj[3:9] = True  # апрель–сентябрь
    p_ampj = p_mm[amj].sum(0)
    p_summer = np.where(north, p_ampj, map_ - p_ampj)
    p_winter = map_ - p_summer

    pth = np.where(p_winter >= 0.7 * map_, 2 * mat,
                   np.where(p_summer >= 0.7 * map_, 2 * mat + 28, 2 * mat + 14))

    out = np.zeros(mat.shape, np.uint8)
    is_e = thot < 10
    is_b = ~is_e & (map_ < 10 * pth)
    is_a = ~is_e & ~is_b & (tcold >= 18)
    is_c = ~is_e & ~is_b & ~is_a & (tcold > 0)
    is_d = ~is_e & ~is_b & ~is_a & ~is_c

    out[is_a & (pdry >= 60)] = 1
    out[is_a & (pdry < 60) & (pdry >= 100 - map_ / 25)] = 2
    out[is_a & (pdry < 60) & (pdry < 100 - map_ / 25)] = 3
    out[is_b & (map_ < 5 * pth)] = 4
    out[is_b & (map_ >= 5 * pth)] = 5
    out[is_c] = 6
    out[is_d] = 7
    out[is_e] = 8
    out[~land] = 0
    return out


# ---------------------------------------------------------------------------
# Запись для браузера: Uint16, value = offset + q * scale, 65535 = нет данных
# ---------------------------------------------------------------------------
def write_layer(out: Path, key: str, arr: np.ndarray, meta: dict, **info) -> None:
    a = np.asarray(arr, dtype="float64")
    valid = np.isfinite(a)
    lo = float(np.nanmin(a[valid])) if valid.any() else 0.0
    hi = float(np.nanmax(a[valid])) if valid.any() else 1.0
    if info.get("categorical"):
        lo, scale = 0.0, 1.0
    else:
        scale = (hi - lo) / 65534 if hi > lo else 1.0
    q = np.full(a.shape, 65535, np.uint16)
    q[valid] = np.round((a[valid] - lo) / scale).clip(0, 65534).astype(np.uint16)
    fname = f"{key}.bin"
    (out / fname).write_bytes(q.astype("<u2").tobytes())
    meta["layers"][key] = {"file": fname, "offset": lo, "scale": scale,
                           "min": lo, "max": hi, **info}
    log(f"  {key:7s} {lo:10.2f} … {hi:10.2f}  {info.get('units', '')}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    root = Path(__file__).resolve().parent.parent
    ap.add_argument("--cache", type=Path, default=root / ".cache")
    ap.add_argument("--out", type=Path, default=root / "data" / "grid")
    ap.add_argument("--years", default="1995-2014")
    ap.add_argument("--native", action="store_true")
    ap.add_argument("--skip-download", action="store_true")
    args = ap.parse_args()

    y0, y1 = (int(x) for x in args.years.split("-"))
    years = list(range(y0, y1 + 1))
    args.cache.mkdir(parents=True, exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)

    if not args.skip_download:
        download_lightning(args.cache)
        download_era5(args.cache, years, args.native)

    log("Читаю LIS/OTD HRFC …")
    frd = read_lightning(args.cache / "lisotd_hrfc.nc")

    log("Читаю ERA5 и строю климатологию по месяцам …")
    t2m = read_era5_monthly(args.cache / "era5_t2m.nc", "t2m") - 273.15
    tp = read_era5_monthly(args.cache / "era5_tp.nc", "tp")           # м/сутки
    tcwv = read_era5_monthly(args.cache / "era5_tcwv.nc", "tcwv")     # кг/м² = мм
    cape = read_era5_monthly(args.cache / "era5_cape.nc", "cape")     # Дж/кг
    z = read_era5_static(args.cache / "era5_z.nc", "z")
    lsm = read_era5_static(args.cache / "era5_lsm.nc", "lsm")

    p_month = tp * 1000 * DAYS_IN_MONTH[:, None, None]                # мм/мес
    land = lsm >= 0.5
    elev = z / 9.80665
    kz = koppen(t2m, p_month, land)

    meta = {
        "title": "Where Lightning Strikes Most",
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "grid": {"nlat": NLAT, "nlon": NLON, "lat0": float(LATS[0]), "lon0": float(LONS[0]),
                 "step": STEP, "order": "row-major, north→south, west→east", "dtype": "uint16le",
                 "nodata": 65535},
        "period": {"lightning": "1995-05 – 2014-12", "era5": f"{y0}–{y1}"},
        "koppen": {str(k): {"code": v[0], "name": v[1]} for k, v in KOPPEN.items()},
        "sources": [
            "NASA LIS/OTD 0.5° High Resolution Full Climatology (HRFC) V2.3.2015, doi:10.5067/LIS/LIS-OTD/DATA302",
            "Copernicus ERA5 monthly averaged reanalysis on single levels, doi:10.24381/cds.f17050d7",
        ],
        "layers": {},
    }
    log("Пишу слои:")
    write_layer(args.out, "frd", frd, meta, units="вспышек/км²/год", label="Молнии")
    write_layer(args.out, "tcwv", tcwv.mean(0), meta, units="мм", label="Водяной пар в столбе атмосферы")
    write_layer(args.out, "cape", cape.mean(0), meta, units="Дж/кг", label="Неустойчивость атмосферы (CAPE)")
    write_layer(args.out, "precip", p_month.sum(0), meta, units="мм/год", label="Осадки")
    write_layer(args.out, "elev", elev, meta, units="м", label="Высота рельефа")
    write_layer(args.out, "land", lsm, meta, units="доля", label="Доля суши в ячейке")
    write_layer(args.out, "koppen", kz.astype("float64"), meta, label="Климатические зоны Кёппена",
                categorical=True)

    (args.out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    i, j = np.unravel_index(np.argmax(frd), frd.shape)
    log(f"Готово. Максимум молний: {frd[i, j]:.1f} вспышек/км²/год в ячейке "
        f"{LATS[i]:.2f}°, {LONS[j]:.2f}°")
    log(f"Средняя плотность: суша {frd[land].mean():.1f}, океан {frd[~land].mean():.1f}")


if __name__ == "__main__":
    main()

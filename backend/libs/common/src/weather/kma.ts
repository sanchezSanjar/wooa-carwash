/**
 * Korea Meteorological Administration short-term forecast (단기예보, VilageFcstInfoService_2.0).
 * Free key from https://www.data.go.kr (search "기상청_단기예보 조회서비스").
 * Forecasts are per 5 km grid square (nx, ny); see `gridFromLatLng`.
 */

export const KMA_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';

/** Releases happen at 02, 05, 08, 11, 14, 17, 20, 23 h (Korea time) and are online ~10 minutes later. */
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];

export interface DayForecast {
  /** YYYY-MM-DD */
  date: string;
  /** Highest chance of precipitation between 06:00 and 21:00 (%). */
  pop: number;
  /** Rain or snow expected in daytime hours (PTY > 0). */
  precipitation: 'none' | 'rain' | 'snow' | 'mixed';
  tempMin: number | null;
  tempMax: number | null;
  /** Short English summary, e.g. "Rain likely (70%) · 4–11°C". */
  summary: string;
}

/** Latest forecast release available at `now`: { baseDate: YYYYMMDD, baseTime: HHmm }. */
export function latestBase(now = new Date()): { baseDate: string; baseTime: string } {
  const kst = new Date(now.getTime() + 9 * 3_600_000 - 15 * 60_000); // 15 minutes after a release
  const hour = kst.getUTCHours();
  const base = [...BASE_HOURS].reverse().find((h) => h <= hour);
  const day = base === undefined ? new Date(kst.getTime() - 86_400_000) : kst;
  const ymd = day.toISOString().slice(0, 10).replace(/-/g, '');
  return { baseDate: ymd, baseTime: `${String(base ?? 23).padStart(2, '0')}00` };
}

interface KmaItem {
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
}

export async function fetchForecast(
  key: string,
  grid: { nx: number; ny: number },
  now = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<DayForecast[]> {
  const { baseDate, baseTime } = latestBase(now);
  const params = new URLSearchParams({
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });
  // the key from data.go.kr is usually already URL-encoded: pass it as-is
  const res = await fetcher(`${KMA_URL}?serviceKey=${key}&${params.toString()}`);
  if (!res.ok) throw new Error(`KMA responded ${res.status}`);
  const body = (await res.json()) as {
    response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: KmaItem[] } } };
  };
  const code = body.response?.header?.resultCode;
  if (code !== '00') throw new Error(`KMA error ${code}: ${body.response?.header?.resultMsg ?? 'unknown'}`);
  return summarize(body.response?.body?.items?.item ?? []);
}

/** Turns hourly KMA items into one summary per day. */
export function summarize(items: KmaItem[]): DayForecast[] {
  const days = new Map<string, { pop: number; pty: Set<number>; tmn: number | null; tmx: number | null; temps: number[] }>();
  for (const it of items) {
    const date = `${it.fcstDate.slice(0, 4)}-${it.fcstDate.slice(4, 6)}-${it.fcstDate.slice(6, 8)}`;
    const hour = Number(it.fcstTime.slice(0, 2));
    const d = days.get(date) ?? { pop: 0, pty: new Set<number>(), tmn: null, tmx: null, temps: [] };
    const value = Number(it.fcstValue);
    const daytime = hour >= 6 && hour <= 21;
    if (it.category === 'POP' && daytime && Number.isFinite(value)) d.pop = Math.max(d.pop, value);
    if (it.category === 'PTY' && daytime && value > 0) d.pty.add(value);
    if (it.category === 'TMN' && Number.isFinite(value)) d.tmn = value;
    if (it.category === 'TMX' && Number.isFinite(value)) d.tmx = value;
    if (it.category === 'TMP' && Number.isFinite(value)) d.temps.push(value);
    days.set(date, d);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      const kinds = [...d.pty];
      // PTY: 1 rain, 2 rain/snow, 3 snow, 4 shower
      const precipitation: DayForecast['precipitation'] =
        kinds.length === 0 ? 'none' : kinds.every((k) => k === 3) ? 'snow' : kinds.some((k) => k === 2 || k === 3) ? 'mixed' : 'rain';
      const tempMin = d.tmn ?? (d.temps.length ? Math.min(...d.temps) : null);
      const tempMax = d.tmx ?? (d.temps.length ? Math.max(...d.temps) : null);
      const word = precipitation === 'snow' ? 'Snow' : precipitation === 'mixed' ? 'Rain or snow' : 'Rain';
      const sky = precipitation !== 'none' || d.pop >= 60 ? `${word} likely (${d.pop}%)` : d.pop >= 30 ? `Chance of rain ${d.pop}%` : 'Dry';
      const temps = tempMin !== null && tempMax !== null ? ` · ${Math.round(tempMin)}–${Math.round(tempMax)}°C` : '';
      return { date, pop: d.pop, precipitation, tempMin, tempMax, summary: `${sky}${temps}` };
    });
}

/** Rain or snow is likely enough to warn members. */
export const isWet = (f: Pick<DayForecast, 'pop' | 'precipitation'>, threshold = 60) => f.precipitation !== 'none' || f.pop >= threshold;

/** KMA's Lambert conformal grid (official conversion), for apartments known by latitude/longitude. */
export function gridFromLatLng(lat: number, lng: number): { nx: number; ny: number } {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD, olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

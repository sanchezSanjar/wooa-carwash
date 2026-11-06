import { fetchForecast, gridFromLatLng, isWet, latestBase, summarize } from './kma';

const item = (category: string, date: string, time: string, value: string | number) => ({
  category,
  fcstDate: date,
  fcstTime: time,
  fcstValue: String(value),
});

describe('KMA forecast', () => {
  it('picks the latest available release', () => {
    expect(latestBase(new Date('2026-11-06T08:30:00Z'))).toEqual({ baseDate: '20261106', baseTime: '1700' }); // 17:30 KST
    expect(latestBase(new Date('2026-11-06T08:05:00Z'))).toEqual({ baseDate: '20261106', baseTime: '1400' }); // 17:05: not online yet
    expect(latestBase(new Date('2026-11-06T16:10:00Z'))).toEqual({ baseDate: '20261106', baseTime: '2300' }); // 01:10 next day
  });

  it('summarizes rain and temperatures per day', () => {
    const days = summarize([
      item('POP', '20261107', '0900', 30),
      item('POP', '20261107', '1500', 70),
      item('PTY', '20261107', '1500', 1),
      item('POP', '20261107', '2300', 90), // night: ignored
      item('TMN', '20261107', '0600', 4),
      item('TMX', '20261107', '1500', 11),
      item('POP', '20261108', '1200', 20),
      item('TMP', '20261108', '1200', 9),
      item('TMP', '20261108', '0600', 2),
    ]);
    expect(days[0]).toMatchObject({ date: '2026-11-07', pop: 70, precipitation: 'rain', summary: 'Rain likely (70%) · 4–11°C' });
    expect(days[1]).toMatchObject({ date: '2026-11-08', pop: 20, precipitation: 'none', summary: 'Dry · 2–9°C' });
    expect(isWet(days[0])).toBe(true);
    expect(isWet(days[1])).toBe(false);
  });

  it('calls the API with the grid and reports API errors', async () => {
    let url = '';
    const ok = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ response: { header: { resultCode: '00' }, body: { items: { item: [item('POP', '20261107', '1200', 10)] } } } }));
    }) as unknown as typeof fetch;
    const days = await fetchForecast('KEY%2B1', { nx: 60, ny: 127 }, new Date('2026-11-06T08:30:00Z'), ok);
    expect(days).toHaveLength(1);
    expect(url).toContain('serviceKey=KEY%2B1&');
    expect(url).toContain('nx=60&ny=127');

    const bad = (async () =>
      new Response(JSON.stringify({ response: { header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' } } }))) as unknown as typeof fetch;
    await expect(fetchForecast('x', { nx: 60, ny: 127 }, new Date(), bad)).rejects.toThrow(/KMA error 30/);
  });

  it('converts latitude/longitude to the KMA grid', () => {
    expect(gridFromLatLng(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 }); // Seoul City Hall
  });
});

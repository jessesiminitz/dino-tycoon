/**
 * How dark it is and how warm the light is at a time of day (hour 0–24, with
 * fractions). Full daylight from 07:00 to 17:00; dusk deepens until 20:30;
 * night until 05:00; dawn lightens until 07:00. The warm glow peaks at sunset
 * and sunrise.
 */
export function lightAt(hour: number): { dark: number; warm: number } {
  const smooth = (t: number) => t * t * (3 - 2 * t);
  let dark = 0;
  if (hour >= 17 && hour < 20.5) dark = smooth((hour - 17) / 3.5);
  else if (hour >= 20.5 || hour < 5) dark = 1;
  else if (hour >= 5 && hour < 7) dark = 1 - smooth((hour - 5) / 2);
  const warm = Math.max(0, 1 - Math.abs(hour - 18.5) / 1.6, 1 - Math.abs(hour - 6) / 1);
  return { dark, warm };
}

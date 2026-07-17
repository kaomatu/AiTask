export const getDefaultPeriodTime = (p: number, prevEndTime?: string): { start: string; end: string } => {
  const defaults: Record<number, { start: string; end: string }> = {
    1: { start: '09:00', end: '10:30' },
    2: { start: '10:40', end: '12:10' },
    3: { start: '13:00', end: '14:30' },
    4: { start: '14:40', end: '16:10' },
    5: { start: '16:20', end: '17:50' },
    6: { start: '18:00', end: '19:30' },
    7: { start: '19:40', end: '21:10' },
    8: { start: '21:20', end: '22:50' },
    9: { start: '23:00', end: '00:30' },
  };

  if (defaults[p]) return defaults[p];

  if (prevEndTime) {
    try {
      const [h, m] = prevEndTime.split(':').map(Number);
      const totalMinutes = h * 60 + m + 10;
      const startH = Math.floor(totalMinutes / 60) % 24;
      const startM = totalMinutes % 60;
      
      const endTotalMinutes = totalMinutes + 90;
      const endH = Math.floor(endTotalMinutes / 60) % 24;
      const endM = endTotalMinutes % 60;

      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        start: `${pad(startH)}:${pad(startM)}`,
        end: `${pad(endH)}:${pad(endM)}`
      };
    } catch (e) {
      // ignore and fallback
    }
  }

  return { start: '09:00', end: '10:30' };
};

export const validateTimeFormat = (timeStr: string): boolean => {
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(timeStr);
};

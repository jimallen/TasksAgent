/**
 * Date formatting utilities for consistent date handling across the application
 */

export const formatDateForObsidian = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatTimeForSchedule = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const formatDateTimeForLog = (date: Date): string => {
  return date.toISOString().replace('T', ' ').slice(0, 19);
};

export const parseScheduleTime = (timeString: string): { hours: number; minutes: number } => {
  const parts = timeString.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeString}`);
  }
  return { hours, minutes };
};

export const getDateRangeForEmailCheck = (hoursBack: number): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1000);
  return { start, end };
};

export const formatMeetingFileName = (meetingTitle: string, date: Date): string => {
  const dateStr = formatDateForObsidian(date);
  const sanitizedTitle = meetingTitle
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50); // Limit filename length
  
  return `${dateStr}-${sanitizedTitle}.md`;
};

export const isWithinBusinessHours = (date: Date): boolean => {
  const hours = date.getHours();
  const dayOfWeek = date.getDay();
  
  // Monday-Friday, 8 AM - 6 PM
  return dayOfWeek >= 1 && dayOfWeek <= 5 && hours >= 8 && hours < 18;
};

export const getNextScheduledTime = (scheduleTimes: string[]): Date | null => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  for (const timeStr of scheduleTimes) {
    const { hours, minutes } = parseScheduleTime(timeStr);
    const scheduledTime = new Date(today);
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    if (scheduledTime > now) {
      return scheduledTime;
    }
  }
  
  // If no times today, return first time tomorrow
  if (scheduleTimes.length > 0 && scheduleTimes[0]) {
    const { hours, minutes } = parseScheduleTime(scheduleTimes[0]);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hours, minutes, 0, 0);
    return tomorrow;
  }
  
  return null;
};

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};
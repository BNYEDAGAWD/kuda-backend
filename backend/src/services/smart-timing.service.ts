/**
 * Smart Timing Service - Optimal Email Send Time Calculation
 *
 * Implements smart notification timing (Tue-Thu 10AM-4PM) to avoid:
 * - Friday PM sends (96-hour delays observed in empirical data)
 * - Monday AM inbox overload
 * - Weekend sends
 *
 * Kuda Ocean tier and rejection emails bypass smart timing for immediate send.
 */

import { Logger } from '../utils/logger';

const logger = new Logger('SmartTimingService');

export type TimingRule =
  | 'immediate'
  | 'friday_pm_to_tuesday'
  | 'weekend_to_tuesday'
  | 'monday_to_tuesday'
  | 'optimal_window'
  | 'next_optimal_window';

export interface SmartTimingResult {
  calculated_send_time: Date;
  timing_rule_applied: TimingRule;
  was_delayed: boolean;
  delay_reason: string | null;
  original_time: Date;
}

export class SmartTimingService {
  /**
   * Calculate optimal send time based on smart timing rules
   *
   * @param notification_type - Type of notification
   * @param sender_tier - 'kuda_ocean' or 'system'
   * @param requested_time - When the notification was requested (defaults to now)
   * @returns SmartTimingResult with calculated send time and metadata
   */
  calculateOptimalSendTime(
    notification_type: string,
    sender_tier: 'kuda_ocean' | 'system',
    requested_time: Date = new Date()
  ): SmartTimingResult {
    const original_time = new Date(requested_time);

    // RULE 1: Kuda Ocean tier bypasses smart timing (immediate send)
    if (sender_tier === 'kuda_ocean') {
      logger.debug('Immediate send: Kuda Ocean tier', {
        notification_type,
        sender_tier
      });

      return {
        calculated_send_time: original_time,
        timing_rule_applied: 'immediate',
        was_delayed: false,
        delay_reason: null,
        original_time
      };
    }

    // RULE 2: Rejection emails bypass smart timing (urgent)
    if (this.isRejectionNotification(notification_type)) {
      logger.debug('Immediate send: Rejection email', {
        notification_type
      });

      return {
        calculated_send_time: original_time,
        timing_rule_applied: 'immediate',
        was_delayed: false,
        delay_reason: null,
        original_time
      };
    }

    // RULE 3: Apply smart timing for automated system notifications
    return this.applySmartTiming(original_time);
  }

  /**
   * Apply smart timing rules to requested time
   */
  private applySmartTiming(requested_time: Date): SmartTimingResult {
    const day_of_week = requested_time.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const hour = requested_time.getHours();
    const minute = requested_time.getMinutes();

    // RULE 3a: Friday after 4 PM → Tuesday 10 AM
    if (day_of_week === 5 && hour >= 16) {
      const tuesday_10am = this.getNextTuesday10AM(requested_time);
      logger.debug('Delayed: Friday PM to Tuesday', {
        requested: requested_time,
        calculated: tuesday_10am
      });

      return {
        calculated_send_time: tuesday_10am,
        timing_rule_applied: 'friday_pm_to_tuesday',
        was_delayed: true,
        delay_reason: 'Friday after 4PM - delayed to Tuesday 10AM to avoid weekend delay',
        original_time: requested_time
      };
    }

    // RULE 3b: Saturday or Sunday → Tuesday 10 AM
    if (day_of_week === 0 || day_of_week === 6) {
      const tuesday_10am = this.getNextTuesday10AM(requested_time);
      logger.debug('Delayed: Weekend to Tuesday', {
        requested: requested_time,
        calculated: tuesday_10am
      });

      return {
        calculated_send_time: tuesday_10am,
        timing_rule_applied: 'weekend_to_tuesday',
        was_delayed: true,
        delay_reason: 'Weekend - delayed to Tuesday 10AM',
        original_time: requested_time
      };
    }

    // RULE 3c: Monday → Tuesday 10 AM (avoid Monday morning inbox overload)
    if (day_of_week === 1) {
      const tuesday_10am = this.getNextTuesday10AM(requested_time);
      logger.debug('Delayed: Monday to Tuesday', {
        requested: requested_time,
        calculated: tuesday_10am
      });

      return {
        calculated_send_time: tuesday_10am,
        timing_rule_applied: 'monday_to_tuesday',
        was_delayed: true,
        delay_reason: 'Monday - delayed to Tuesday 10AM to avoid inbox overload',
        original_time: requested_time
      };
    }

    // RULE 3d: Tue-Thu before 4 PM → Send within 1 hour (optimal window)
    if ([2, 3, 4].includes(day_of_week) && hour < 16) {
      const send_time = new Date(requested_time);
      send_time.setHours(send_time.getHours() + 1);

      logger.debug('Optimal window: Send within 1 hour', {
        requested: requested_time,
        calculated: send_time
      });

      return {
        calculated_send_time: send_time,
        timing_rule_applied: 'optimal_window',
        was_delayed: false,
        delay_reason: null,
        original_time: requested_time
      };
    }

    // RULE 3e: Otherwise → Next Tue-Thu 10-11 AM window
    const next_window = this.getNextOptimalWindow(requested_time);
    logger.debug('Delayed: Next optimal window', {
      requested: requested_time,
      calculated: next_window
    });

    return {
      calculated_send_time: next_window,
      timing_rule_applied: 'next_optimal_window',
      was_delayed: true,
      delay_reason: 'Outside optimal window - scheduled for next Tue-Thu 10AM',
      original_time: requested_time
    };
  }

  /**
   * Get next Tuesday at 10 AM
   */
  private getNextTuesday10AM(from: Date): Date {
    const result = new Date(from);
    const current_day = result.getDay();

    // Calculate days until next Tuesday (2)
    let days_to_add: number;
    if (current_day <= 2) {
      days_to_add = 2 - current_day;
    } else {
      days_to_add = 7 - current_day + 2; // Next week's Tuesday
    }

    // If it's already Tuesday but past 10 AM, go to next Tuesday
    if (current_day === 2 && result.getHours() >= 10) {
      days_to_add = 7;
    }

    result.setDate(result.getDate() + days_to_add);
    result.setHours(10, 0, 0, 0); // 10:00:00 AM

    return result;
  }

  /**
   * Get next optimal send window (Tue-Thu 10-11 AM)
   */
  private getNextOptimalWindow(from: Date): Date {
    const result = new Date(from);
    const current_day = result.getDay();
    const current_hour = result.getHours();

    // Optimal days: Tue (2), Wed (3), Thu (4)
    const optimal_days = [2, 3, 4];

    // If current day is optimal and before 11 AM, schedule for 10 AM today
    if (optimal_days.includes(current_day) && current_hour < 10) {
      result.setHours(10, Math.floor(Math.random() * 60), 0, 0); // Random minute in 10AM hour
      return result;
    }

    // Otherwise, find next optimal day
    let days_to_add = 1;
    let next_day = (current_day + days_to_add) % 7;

    while (!optimal_days.includes(next_day) || days_to_add > 7) {
      days_to_add++;
      next_day = (current_day + days_to_add) % 7;
    }

    result.setDate(result.getDate() + days_to_add);
    result.setHours(10, Math.floor(Math.random() * 60), 0, 0); // Random minute in 10AM hour

    return result;
  }

  /**
   * Check if notification type is a rejection
   */
  private isRejectionNotification(notification_type: string): boolean {
    const rejection_types = [
      'asset_pack_rejected',
      'deliverable_rejected',
      'revision_rejected'
    ];

    return rejection_types.some(type =>
      notification_type.toLowerCase().includes(type)
    );
  }

  /**
   * Get timing compliance statistics
   */
  getTimingStats(results: SmartTimingResult[]): {
    total: number;
    immediate: number;
    delayed: number;
    delayed_percentage: number;
    average_delay_hours: number;
    by_rule: Record<TimingRule, number>;
  } {
    const total = results.length;
    const immediate = results.filter(r => !r.was_delayed).length;
    const delayed = results.filter(r => r.was_delayed).length;

    // Calculate average delay in hours
    const total_delay_ms = results
      .filter(r => r.was_delayed)
      .reduce((sum, r) => {
        const delay = r.calculated_send_time.getTime() - r.original_time.getTime();
        return sum + delay;
      }, 0);

    const average_delay_hours = delayed > 0
      ? total_delay_ms / delayed / (1000 * 60 * 60)
      : 0;

    // Count by rule
    const by_rule: Record<TimingRule, number> = {
      immediate: 0,
      friday_pm_to_tuesday: 0,
      weekend_to_tuesday: 0,
      monday_to_tuesday: 0,
      optimal_window: 0,
      next_optimal_window: 0
    };

    results.forEach(r => {
      by_rule[r.timing_rule_applied]++;
    });

    return {
      total,
      immediate,
      delayed,
      delayed_percentage: total > 0 ? (delayed / total) * 100 : 0,
      average_delay_hours,
      by_rule
    };
  }

  /**
   * Validate if a time is in optimal send window
   */
  isOptimalSendTime(time: Date): boolean {
    const day_of_week = time.getDay();
    const hour = time.getHours();

    // Tue-Thu, 10 AM - 4 PM
    return [2, 3, 4].includes(day_of_week) && hour >= 10 && hour < 16;
  }
}

export default SmartTimingService;

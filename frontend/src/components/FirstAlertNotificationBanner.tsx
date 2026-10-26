import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight, X, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import type { AlertNotificationRecord } from '../types';

interface FirstAlertNotificationBannerProps {
  onReviewNow: (employeeId: string, alertId: string) => void;
}

export const FirstAlertNotificationBanner: React.FC<FirstAlertNotificationBannerProps> = ({
  onReviewNow
}) => {
  const [notifications, setNotifications] = useState<AlertNotificationRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [dismissedLocally, setDismissedLocally] = useState<boolean>(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const res = await api.getScrutinyNotifications();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error('[NotificationBanner] Failed to load alerts notifications:', err);
    }
  }

  async function handleReviewLater(notif: AlertNotificationRecord) {
    try {
      await api.dismissScrutinyNotification(notif.id);
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (err) {
      console.error('[NotificationBanner] Error dismissing notification:', err);
    }
  }

  if (dismissedLocally || notifications.length === 0) return null;

  const current = notifications[currentIndex % notifications.length];
  if (!current) return null;

  return (
    <div className="bg-[#17140B] border-b border-[#F2D35E]/30 px-6 py-2.5 text-xs font-mono text-[#EEEEEE] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shrink-0">
      <div className="flex items-center space-x-3">
        <div className="p-1 bg-[#F2D35E]/10 border border-[#F2D35E]/40 text-[#F2D35E] rounded shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <span className="font-bold text-[#F2D35E] mr-2">
            {current.isFirstAlert ? 'FIRST ALERT TRIAGE' : 'RECURRING ALERT'}:
          </span>
          <span className="text-[#DDDDDD]">{current.message}</span>
          {notifications.length > 1 && (
            <span className="text-[10px] text-[#888888] ml-2">
              ({(currentIndex % notifications.length) + 1} of {notifications.length} pending)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
        <button
          onClick={() => onReviewNow(current.employeeId, current.alertId)}
          className="px-3 py-1 bg-[#F2D35E] hover:bg-[#E5C550] text-[#0A0A0A] font-bold text-[11px] transition-colors flex items-center space-x-1"
        >
          <span>Review Now</span>
          <ChevronRight className="w-3 h-3" />
        </button>

        <button
          onClick={() => handleReviewLater(current)}
          className="px-2.5 py-1 bg-[#222222] hover:bg-[#2C2C2C] text-[#AAAAAA] hover:text-white border border-[#333333] text-[11px] transition-colors"
          title="Keep in unresolved list"
        >
          Review Later
        </button>

        {notifications.length > 1 && (
          <button
            onClick={() => setCurrentIndex(prev => prev + 1)}
            className="p-1 text-[#777777] hover:text-white"
            title="Next notification"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => setDismissedLocally(true)}
          className="p-1 text-[#666666] hover:text-white ml-1"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

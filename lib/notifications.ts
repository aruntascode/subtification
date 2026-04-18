import type { Subscription } from "@/stores/subscriptionStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import i18n from "@/locales/i18n";

const NOTIFICATION_PREF_KEY = "push_alerts_enabled";
const SCHEDULED_NOTIFICATION_IDS_KEY = "scheduled_subscription_notification_ids";
const ANDROID_CHANNEL_ID = "subscription-reminders";
const REMINDER_HOUR = 9;

type StoredNotification = {
  subscriptionId: string;
  notificationId: string;
};

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function getPushAlertsEnabled() {
  return (await AsyncStorage.getItem(NOTIFICATION_PREF_KEY)) === "true";
}

export async function setPushAlertsEnabled(enabled: boolean) {
  await AsyncStorage.setItem(NOTIFICATION_PREF_KEY, String(enabled));
}

export async function ensureNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return requested.granted;
}

export async function syncSubscriptionNotifications(subscriptions: Subscription[]) {
  try {
    const enabled = await getPushAlertsEnabled();
    if (!enabled) {
      await cancelSubscriptionNotifications();
      return;
    }

    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;

    await ensureAndroidChannel();
    await cancelSubscriptionNotifications();

    const scheduled: StoredNotification[] = [];
    const reminders = subscriptions
      .filter((sub) => sub.is_active)
      .map((subscription) => ({
        subscription,
        reminderDate: getReminderDate(subscription.next_billing_date),
      }))
      .filter(
        (item): item is { subscription: Subscription; reminderDate: Date } =>
          item.reminderDate !== null,
      )
      .sort((a, b) => a.reminderDate.getTime() - b.reminderDate.getTime())
      .slice(0, 60);

    for (const { subscription, reminderDate } of reminders) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t("notifications.payment_reminder_title"),
          body: i18n.t("notifications.payment_reminder_body", {
            name: subscription.name,
          }),
          sound: true,
          data: {
            subscriptionId: subscription.id,
            type: "subscription-payment-reminder",
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
        },
      });

      scheduled.push({ subscriptionId: subscription.id, notificationId });
    }

    await AsyncStorage.setItem(
      SCHEDULED_NOTIFICATION_IDS_KEY,
      JSON.stringify(scheduled),
    );
  } catch (error) {
    console.warn("Subscription notifications could not be synced.", error);
  }
}

export async function cancelSubscriptionNotifications() {
  try {
    const stored = await getStoredNotifications();

    await Promise.all(
      stored.map(({ notificationId }) =>
        Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {}),
      ),
    );

    await AsyncStorage.removeItem(SCHEDULED_NOTIFICATION_IDS_KEY);
  } catch (error) {
    console.warn("Subscription notifications could not be cancelled.", error);
  }
}

async function getStoredNotifications(): Promise<StoredNotification[]> {
  const raw = await AsyncStorage.getItem(SCHEDULED_NOTIFICATION_IDS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is StoredNotification =>
        typeof item?.subscriptionId === "string" &&
        typeof item?.notificationId === "string",
    );
  } catch {
    return [];
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Subscription reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#9ab7ff",
  });
}

function getReminderDate(nextBillingDate: string) {
  const billingDate = parseLocalDate(nextBillingDate);
  if (!billingDate) return null;

  const reminder = new Date(billingDate);
  reminder.setDate(reminder.getDate() - 1);
  reminder.setHours(REMINDER_HOUR, 0, 0, 0);

  const sameDayReminder = new Date(billingDate);
  sameDayReminder.setHours(REMINDER_HOUR, 0, 0, 0);

  const now = new Date();
  if (reminder > now) return reminder;
  if (sameDayReminder > now) return sameDayReminder;

  return null;
}

function parseLocalDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

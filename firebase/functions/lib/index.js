"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCleanupReminderReceipts = exports.sendDueCleanupReminders = exports.syncReminderInstallation = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const luxon_1 = require("luxon");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const REGION = "europe-west1";
const EXPO_ACCESS_TOKEN = (0, params_1.defineSecret)("EXPO_ACCESS_TOKEN");
const INSTALLATIONS = "pushInstallations";
const RECEIPTS = "pushReceipts";
const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
function text(value, fallback, maxLength) {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim().slice(0, maxLength)
        : fallback;
}
function validExpoToken(value) {
    return (typeof value === "string" &&
        /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value));
}
function normalizeSchedules(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => Boolean(item) && typeof item === "object")
        .map((item, index) => {
        const days = Array.isArray(item.days)
            ? [...new Set(item.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
            : [];
        const times = Array.isArray(item.times)
            ? [...new Set(item.times.filter((time) => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))]
            : [];
        return {
            id: text(item.id, `schedule-${index + 1}`, 64),
            label: text(item.label, "Cleanup reminder", 64),
            active: item.active === true,
            days: days.slice(0, 7),
            times: times.slice(0, 5),
            targetMB: Math.min(1000, Math.max(10, Math.round(Number(item.targetMB) || 50))),
        };
    })
        .filter((schedule) => schedule.active && schedule.days.length > 0 && schedule.times.length > 0)
        .slice(0, 8);
}
function normalizeSmart(value) {
    const item = value && typeof value === "object" ? value : {};
    return {
        enabled: item.enabled === true,
        streak: item.streak !== false,
        storage: item.storage !== false,
        newPhotos: item.newPhotos !== false,
        cleanup: item.cleanup !== false,
        weekly: item.weekly !== false,
    };
}
function smartCandidate(value, now = luxon_1.DateTime.utc()) {
    const snapshot = value.engagementSnapshot;
    if (!value.smartReminders?.enabled || !snapshot?.capturedAt)
        return null;
    const captured = luxon_1.DateTime.fromISO(String(snapshot.capturedAt));
    if (!captured.isValid || now.diff(captured, "hours").hours > 72)
        return null;
    const capacity = Number(snapshot.deviceCapacityMB);
    const free = Number(snapshot.freeSpaceMB);
    const photoCount = Number(snapshot.photoCount) || 0;
    const totalSize = Number(snapshot.totalSizeMB) || 0;
    const screenshots = Number(snapshot.screenshotsCount) || 0;
    const similar = Number(snapshot.similarCount) || 0;
    const cleanupMB = (Number(snapshot.trimSavingsMB) || 0) + (Number(snapshot.deleteSavingsMB) || 0);
    const candidates = [];
    if (value.smartReminders.storage && capacity > 0 && free / capacity < 0.1)
        candidates.push({ trigger: "low-storage", priority: free / capacity < 0.05 ? 100 : 90, title: "Your iPhone is running low on space", body: "A quick TrimSwipe session could free up room.", screen: "games" });
    if (value.smartReminders.streak && (value.streak ?? 0) >= 2 && (value.reviewedToday ?? 0) === 0 && now.setZone(value.timezone).hour >= 18)
        candidates.push({ trigger: "streak-at-risk", priority: 80, title: "Keep your cleanup streak going", body: "A few quick swipes are enough for today.", screen: "games" });
    const lastCleanup = value.lastCleanupAt ? luxon_1.DateTime.fromISO(value.lastCleanupAt) : null;
    const daysSinceCleanup = lastCleanup?.isValid ? now.diff(lastCleanup, "days").days : 999;
    if (value.smartReminders.newPhotos && (photoCount >= 25 || totalSize >= 250) && daysSinceCleanup >= 3)
        candidates.push({ trigger: "new-photos", priority: 70, title: "Your camera roll has grown", body: "TrimSwipe can help you clear a little space.", screen: "games" });
    if (value.smartReminders.cleanup && daysSinceCleanup >= 7 && (cleanupMB >= 500 || screenshots >= 50 || similar >= 20))
        candidates.push({ trigger: "cleanup-opportunity", priority: 60, title: "A useful cleanup is waiting", body: "TrimSwipe found photos you may want to review.", screen: "games" });
    if (value.smartReminders.cleanup && daysSinceCleanup >= 7 && cleanupMB >= 500)
        candidates.push({ trigger: "inactivity", priority: 50, title: "Ready for a fresh start?", body: "Your photo library may be ready for a quick refresh.", screen: "games" });
    if (value.smartReminders.weekly && now.setZone(value.timezone).weekday === 7 && now.setZone(value.timezone).hour >= 18 && (value.reviewedToday ?? 0) === 0 && (value.streak ?? 0) > 0)
        candidates.push({ trigger: "weekly-progress", priority: 40, title: "Make a little progress this week", body: "Open TrimSwipe for a short cleanup session.", screen: "games" });
    return candidates.sort((a, b) => b.priority - a.priority)[0] ?? null;
}
function nextReminderAt(schedules, timezone, after = luxon_1.DateTime.utc()) {
    const localAfter = after.setZone(timezone);
    let next = null;
    for (let offset = 0; offset <= 8; offset += 1) {
        const date = localAfter.startOf("day").plus({ days: offset });
        const jsWeekday = date.weekday % 7;
        for (const schedule of schedules) {
            if (!schedule.active || !schedule.days.includes(jsWeekday))
                continue;
            for (const value of schedule.times) {
                const [hour, minute] = value.split(":").map(Number);
                const candidate = date.set({ hour, minute, second: 0, millisecond: 0 });
                if (candidate <= localAfter || (next && candidate >= next))
                    continue;
                next = candidate;
            }
        }
    }
    return next?.toUTC() ?? null;
}
function scheduleDueAt(schedules, timezone, dueAt) {
    const local = dueAt.setZone(timezone);
    const jsWeekday = local.weekday % 7;
    return (schedules.find((schedule) => schedule.active &&
        schedule.days.includes(jsWeekday) &&
        schedule.times.includes(local.toFormat("HH:mm"))) ?? schedules.find((schedule) => schedule.active) ?? null);
}
exports.syncReminderInstallation = (0, https_1.onCall)({ region: REGION, enforceAppCheck: false }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Authentication is required.");
    const data = request.data;
    const enabled = data.enabled === true;
    const timezone = text(data.timezone, "UTC", 80);
    if (!luxon_1.IANAZone.isValidZone(timezone)) {
        throw new https_1.HttpsError("invalid-argument", "A valid IANA timezone is required.");
    }
    const schedules = enabled ? normalizeSchedules(data.schedules) : [];
    const smartReminders = normalizeSmart(data.smartReminders);
    const expoPushToken = enabled && validExpoToken(data.expoPushToken) ? data.expoPushToken : null;
    if (enabled && (!expoPushToken || (schedules.length === 0 && !smartReminders.enabled))) {
        throw new https_1.HttpsError("invalid-argument", "An Expo push token and active schedule are required.");
    }
    const next = nextReminderAt(schedules, timezone);
    const now = luxon_1.DateTime.utc();
    await db.collection(INSTALLATIONS).doc(request.auth.uid).set({
        uid: request.auth.uid,
        expoPushToken,
        enabled: Boolean(enabled && expoPushToken && (next || smartReminders.enabled)),
        timezone,
        platform: text(data.platform, "unknown", 16),
        appVersion: text(data.appVersion, "unknown", 32),
        schedules,
        nextSendAt: next ? firestore_1.Timestamp.fromDate(next.toJSDate()) : null,
        smartReminders,
        engagementSnapshot: data.engagementSnapshot && typeof data.engagementSnapshot === "object" ? data.engagementSnapshot : null,
        locale: text(data.locale, "en", 16),
        streak: Math.max(0, Math.min(365, Number(data.streak) || 0)),
        reviewedToday: Math.max(0, Math.min(10000, Number(data.reviewedToday) || 0)),
        lastCleanupAt: typeof data.lastCleanupAt === "string" ? data.lastCleanupAt.slice(0, 40) : null,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        expiresAt: firestore_1.Timestamp.fromDate(now.plus({ days: 90 }).toJSDate()),
        leaseUntil: firestore_1.FieldValue.delete(),
    }, { merge: true });
    return { enabled: Boolean(enabled && expoPushToken && (next || smartReminders.enabled)), nextSendAt: next?.toISO() ?? null };
});
async function claimInstallation(document) {
    const reference = document.ref;
    return db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(reference);
        const value = fresh.data();
        const now = firestore_1.Timestamp.now();
        if (!value?.enabled ||
            !value.expoPushToken ||
            !value.nextSendAt ||
            value.nextSendAt.toMillis() > now.toMillis() ||
            (value.leaseUntil && value.leaseUntil.toMillis() > now.toMillis())) {
            return null;
        }
        transaction.update(reference, {
            leaseUntil: firestore_1.Timestamp.fromMillis(now.toMillis() + 10 * 60_000),
        });
        return value;
    });
}
function expoHeaders() {
    return {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${EXPO_ACCESS_TOKEN.value()}`,
    };
}
exports.sendDueCleanupReminders = (0, scheduler_1.onSchedule)({
    schedule: "every 5 minutes",
    timeZone: "UTC",
    region: REGION,
    maxInstances: 1,
    secrets: [EXPO_ACCESS_TOKEN],
}, async () => {
    const now = firestore_1.Timestamp.now();
    const due = await db
        .collection(INSTALLATIONS)
        .where("enabled", "==", true)
        .where("nextSendAt", "<=", now)
        .orderBy("nextSendAt")
        .limit(500)
        .get();
    const claimResults = await Promise.all(due.docs.map(async (document) => ({ document, value: await claimInstallation(document) })));
    const claimed = [];
    for (const item of claimResults) {
        if (item.value)
            claimed.push({ document: item.document, value: item.value });
    }
    for (let start = 0; start < claimed.length; start += 100) {
        const chunk = claimed.slice(start, start + 100);
        const messages = chunk.map(({ value }) => {
            const dueAt = value.nextSendAt?.toDate
                ? luxon_1.DateTime.fromJSDate(value.nextSendAt.toDate(), { zone: "utc" })
                : luxon_1.DateTime.utc();
            const schedule = scheduleDueAt(value.schedules, value.timezone, dueAt);
            return {
                to: value.expoPushToken,
                title: "Time for a quick cleanup?",
                body: schedule
                    ? `${schedule.label}: your ${schedule.targetMB} MB cleanup goal is ready.`
                    : "A few swipes can make your camera roll lighter.",
                sound: "default",
                data: { type: "cleanup-reminder", screen: "automation", scheduleId: schedule?.id ?? null },
            };
        });
        const response = await fetch(EXPO_SEND_URL, {
            method: "POST",
            headers: expoHeaders(),
            body: JSON.stringify(messages),
        });
        if (!response.ok)
            throw new Error(`Expo push request failed: ${response.status} ${await response.text()}`);
        const payload = (await response.json());
        const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
        const batch = db.batch();
        chunk.forEach(({ document, value }, index) => {
            const ticket = tickets[index];
            const next = nextReminderAt(value.schedules, value.timezone, luxon_1.DateTime.utc().plus({ minutes: 1 }));
            if (ticket?.status === "ok") {
                batch.update(document.ref, {
                    lastSentAt: firestore_1.FieldValue.serverTimestamp(),
                    nextSendAt: next ? firestore_1.Timestamp.fromDate(next.toJSDate()) : null,
                    enabled: Boolean(next),
                    leaseUntil: firestore_1.FieldValue.delete(),
                });
                if (ticket.id) {
                    batch.set(db.collection(RECEIPTS).doc(ticket.id), {
                        installationId: document.id,
                        createdAt: firestore_1.FieldValue.serverTimestamp(),
                        checkAfter: firestore_1.Timestamp.fromMillis(Date.now() + 5 * 60_000),
                        expiresAt: firestore_1.Timestamp.fromMillis(Date.now() + 24 * 60 * 60_000),
                    });
                }
            }
            else if (ticket?.details?.error === "DeviceNotRegistered") {
                batch.update(document.ref, { enabled: false, expoPushToken: null, nextSendAt: null, leaseUntil: firestore_1.FieldValue.delete() });
            }
            else {
                batch.update(document.ref, {
                    nextSendAt: firestore_1.Timestamp.fromMillis(Date.now() + 30 * 60_000),
                    leaseUntil: firestore_1.FieldValue.delete(),
                    lastError: ticket?.message ?? "Expo rejected the push request",
                });
            }
        });
        await batch.commit();
    }
    const smartDue = await db.collection(INSTALLATIONS).where("enabled", "==", true).limit(500).get();
    const smartMessages = [];
    const smartDocs = [];
    for (const document of smartDue.docs) {
        const value = document.data();
        const candidate = smartCandidate(value, luxon_1.DateTime.utc());
        const lastSmart = value.lastSmartSentAt?.toDate?.();
        const recentSmart = (value.smartSentAt ?? []).filter((sent) => Date.now() - sent.toMillis() < 7 * 24 * 60 * 60_000);
        const allowed = recentSmart.length < 2 && (!lastSmart || Date.now() - lastSmart.getTime() >= 72 * 60 * 60_000);
        const localHour = luxon_1.DateTime.utc().setZone(value.timezone).hour;
        const lastScheduled = value.lastSentAt?.toDate?.()?.getTime() ?? 0;
        const scheduledCollision = lastScheduled > Date.now() - 24 * 60 * 60_000 ||
            (value.nextSendAt?.toMillis?.() ?? 0) <= Date.now() + 6 * 60 * 60_000;
        if (candidate && allowed && !scheduledCollision && localHour >= 9 && localHour < 20 && value.expoPushToken) {
            smartDocs.push({ document, value, candidate });
            smartMessages.push({ to: value.expoPushToken, title: candidate.title, body: candidate.body, sound: "default", data: { type: "smart-reminder", trigger: candidate.trigger, screen: candidate.screen } });
        }
    }
    for (let start = 0; start < smartMessages.length; start += 100) {
        const chunk = smartMessages.slice(start, start + 100);
        const response = await fetch(EXPO_SEND_URL, { method: "POST", headers: expoHeaders(), body: JSON.stringify(chunk) });
        if (!response.ok)
            throw new Error(`Expo smart push request failed: ${response.status} ${await response.text()}`);
        const payload = (await response.json());
        const tickets = Array.isArray(payload.data) ? payload.data : [payload.data];
        const batch = db.batch();
        smartDocs.slice(start, start + 100).forEach(({ document }, index) => {
            if (tickets[index]?.status === "ok")
                batch.update(document.ref, {
                    lastSmartSentAt: firestore_1.FieldValue.serverTimestamp(),
                    smartSentAt: [...(smartDocs[start + index].value.smartSentAt ?? []).filter((sent) => Date.now() - sent.toMillis() < 7 * 24 * 60 * 60_000), firestore_1.Timestamp.now()],
                    lastSmartTrigger: smartDocs[start + index].candidate.trigger,
                });
        });
        await batch.commit();
    }
});
exports.checkCleanupReminderReceipts = (0, scheduler_1.onSchedule)({
    schedule: "every 15 minutes",
    timeZone: "UTC",
    region: REGION,
    maxInstances: 1,
    secrets: [EXPO_ACCESS_TOKEN],
}, async () => {
    const pending = await db.collection(RECEIPTS).where("checkAfter", "<=", firestore_1.Timestamp.now()).limit(1000).get();
    if (pending.empty)
        return;
    const ids = pending.docs.map((document) => document.id);
    const response = await fetch(EXPO_RECEIPTS_URL, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok)
        throw new Error(`Expo receipt request failed: ${response.status} ${await response.text()}`);
    const payload = (await response.json());
    const batch = db.batch();
    for (const document of pending.docs) {
        const receipt = payload.data[document.id];
        if (!receipt)
            continue;
        const installationId = text(document.data().installationId, "", 128);
        if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered" && installationId) {
            batch.update(db.collection(INSTALLATIONS).doc(installationId), {
                enabled: false,
                expoPushToken: null,
                nextSendAt: null,
                lastError: receipt.message ?? "DeviceNotRegistered",
            });
        }
        batch.delete(document.ref);
    }
    await batch.commit();
});
//# sourceMappingURL=index.js.map
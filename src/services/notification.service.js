const Notification = require('../models/Notification');
const User = require('../models/User');

const CATEGORY_TO_RESPONDER = {
  Robbery: 'Security / Police',
  'Suspicious Activity': 'Security / Police',
  'Domestic Threat': 'Security / Police',
  'Fire Outbreak': 'Fire Service',
  Accident: 'Emergency / Medical',
  'Medical Emergency': 'Medical / Emergency',
};

function responderCategoryForIncident(category) {
  return CATEGORY_TO_RESPONDER[category] || 'Admin / Relevant authority';
}

async function sendExpoPush(messages) {
  const valid = messages.filter((message) => /^ExponentPushToken\[.+\]$/.test(message.to));
  if (valid.length === 0) return { sent: 0 };

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(valid),
  });
  if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
  return { sent: valid.length };
}

async function notifyUsers({ recipientIds = [], type, title, message, relatedReportId = null, region = null }) {
  const uniqueIds = [...new Set(recipientIds.map(String))];
  if (uniqueIds.length === 0) return [];

  const users = await User.find({ _id: { $in: uniqueIds } });
  const notifications = await Notification.insertMany(
    users.map((user) => ({ recipientId: user._id, type, title, message, relatedReportId, region }))
  );

  const pushMessages = [];
  users.forEach((user) => {
    (user.expoPushTokens || []).forEach((to) => pushMessages.push({
      to,
      sound: 'default',
      title,
      body: message,
      data: { type, relatedReportId },
      priority: type === 'Emergency' ? 'high' : 'default',
      channelId: type === 'Emergency' ? 'emergency' : 'updates',
    }));
  });

  try {
    await sendExpoPush(pushMessages);
    await Notification.updateMany({ _id: { $in: notifications.map((n) => n._id) } }, { $set: { pushSent: true } });
  } catch (error) {
    console.error('Expo push delivery failed:', error.message);
  }

  return notifications;
}

module.exports = { CATEGORY_TO_RESPONDER, responderCategoryForIncident, notifyUsers };

/**
 * Seeds the database with the same content as the frontend's
 * data/reports.json and data/alerts.json, plus two demo accounts, so the
 * API-backed app looks identical to the mocked prototype on first run.
 *
 * Usage: pnpm seed
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const Report = require('./models/Report');
const Alert = require('./models/Alert');
const { Counter } = require('./models/Counter');

const REPORTS_SEED = [
  {
    id: 'ER-2024-001',
    category: 'Robbery',
    title: 'Armed robbery reported at Estate Gate 2',
    description:
      'Multiple suspects fled the scene on foot heading towards the back road. Security has been alerted.',
    status: 'Active',
    reporter: 'Anonymous',
    location: 'Lekki Phase 1',
    severity: 'Critical',
  },
  {
    id: 'ER-2024-002',
    category: 'Fire Outbreak',
    title: 'Small fire in residential building',
    description:
      'Fire outbreak in Block C kitchen area, fire service has been notified and is on the way.',
    status: 'Responding',
    reporter: 'Jane Smith',
    location: 'Victoria Island',
    severity: 'High',
  },
  {
    id: 'ER-2024-003',
    category: 'Medical Emergency',
    title: 'Elderly resident requires urgent medical assistance',
    description: 'Resident collapsed near the estate clubhouse, ambulance requested.',
    status: 'Resolved',
    reporter: 'Mike Johnson',
    location: 'Ikoyi',
    severity: 'High',
  },
  {
    id: 'ER-2024-004',
    category: 'Accident',
    title: 'Two-vehicle collision at estate roundabout',
    description: 'Minor injuries reported, road partially blocked.',
    status: 'Responding',
    reporter: 'David Okafor',
    location: 'Lekki Phase 1',
    severity: 'Medium',
  },
  {
    id: 'ER-2024-005',
    category: 'Suspicious Activity',
    title: 'Unknown persons loitering near back fence',
    description: 'Two unfamiliar individuals spotted taking photos of the perimeter fence.',
    status: 'Resolved',
    reporter: 'Grace Adeyemi',
    location: 'Victoria Island',
    severity: 'Low',
  },
  {
    id: 'ER-2024-006',
    category: 'Domestic Threat',
    title: 'Loud domestic disturbance reported',
    description: 'Neighbors reported shouting and signs of a physical altercation.',
    status: 'Active',
    reporter: 'Anonymous',
    location: 'Ikoyi',
    severity: 'High',
  },
];

const ALERTS_SEED = [
  {
    type: 'Emergency',
    title: 'Active emergency nearby',
    message: 'Armed robbery reported 0.5km from your location at Estate Gate 2',
    unread: true,
    relatedReportId: 'ER-2024-001',
  },
  {
    type: 'Update',
    title: 'Report status updated',
    message: 'Your report #ER-2024-001 has been assigned to Officer Johnson',
    unread: true,
    relatedReportId: 'ER-2024-001',
  },
  {
    type: 'Announcement',
    title: 'Community safety meeting',
    message: 'Join us for a community safety discussion on Saturday at 4 PM',
    unread: false,
  },
  {
    type: 'Update',
    title: 'Fire incident resolved',
    message: 'The fire outbreak at Block C has been successfully contained',
    unread: false,
    relatedReportId: 'ER-2024-002',
  },
  {
    type: 'Update',
    title: 'Report resolved',
    message: 'Your report #ER-2024-005 has been marked as resolved',
    unread: false,
    relatedReportId: 'ER-2024-005',
  },
  {
    type: 'Announcement',
    title: 'New security measures',
    message: 'Enhanced security protocols now active at all entry points',
    unread: false,
  },
];

async function seed() {
  await connectDB();
  console.log('Connected. Seeding...');

  await Promise.all([
    Report.deleteMany({}),
    Alert.deleteMany({}),
    Counter.deleteMany({}),
    User.deleteMany({ email: { $in: ['john.doe@example.com', 'officer.johnson@example.com'] } }),
  ]);

  const residentPasswordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('password123', 10);

  const resident = await User.create({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+234 800 000 0000',
    estate: 'Lekki Phase 1',
    passwordHash: residentPasswordHash,
    role: 'resident',
  });

  const admin = await User.create({
    name: 'Officer Johnson',
    email: 'officer.johnson@example.com',
    phone: '+234 801 000 0000',
    estate: 'Lekki Phase 1',
    passwordHash: adminPasswordHash,
    role: 'admin',
  });

  await Report.insertMany(
    REPORTS_SEED.map((r) => ({
      ...r,
      images: [],
      reporterId: r.reporter === 'Anonymous' ? null : resident._id,
      statusHistory: [{ status: r.status, changedBy: admin._id }],
    }))
  );

  await Alert.insertMany(ALERTS_SEED.map((a) => ({ ...a, createdBy: admin._id })));

  await Counter.findByIdAndUpdate(
    `report-${new Date().getFullYear()}`,
    { $set: { seq: REPORTS_SEED.length } },
    { upsert: true }
  );

  console.log('Seed complete:');
  console.log(`  ${REPORTS_SEED.length} reports, ${ALERTS_SEED.length} alerts`);
  console.log('  Demo resident login -> email: john.doe@example.com, password: password123');
  console.log('  Demo admin login    -> email: officer.johnson@example.com, password: password123');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

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

// Mirrors data/reports.json exactly, minus `timeAgo` (the backend stores
// `createdAt` instead - the frontend formats that into a "timeAgo" string
// itself, see utils/time.ts).
const REPORTS_SEED = [
  {
    id: 'ER-2024-001',
    category: 'Robbery',
    title: 'Armed robbery reported near Terminus Market',
    description:
      'Multiple suspects fled the scene on foot heading towards the back road behind the market. Security has been alerted and is combing the area. Residents are advised to avoid the back entrance until further notice.',
    status: 'Active',
    reporter: 'Anonymous',
    location: 'Terminus Market, Jos North',
    region: 'Terminus',
    severity: 'Critical',
  },
  {
    id: 'ER-2024-002',
    category: 'Fire Outbreak',
    title: 'Small fire in residential compound',
    description:
      'Fire outbreak in a Bukuru compound kitchen area, fire service has been notified and is on the way. Smoke visible from the main road.',
    status: 'Responding',
    reporter: 'Jane Smith',
    location: 'Off Bukuru Expressway',
    region: 'Bukuru',
    severity: 'High',
  },
  {
    id: 'ER-2024-003',
    category: 'Medical Emergency',
    title: 'Elderly resident requires urgent medical assistance',
    description:
      'Resident collapsed near the Rayfield community hall, ambulance requested. First responders on site providing basic care while awaiting transport.',
    status: 'Resolved',
    reporter: 'Mike Johnson',
    location: 'Rayfield Community Hall',
    region: 'Rayfield',
    severity: 'High',
  },
  {
    id: 'ER-2024-004',
    category: 'Accident',
    title: 'Two-vehicle collision at Farin Gada roundabout',
    description: 'Minor injuries reported, road partially blocked in both directions. Traffic wardens have been notified.',
    status: 'Responding',
    reporter: 'David Okafor',
    location: 'Farin Gada Roundabout',
    region: 'Farin Gada',
    severity: 'Medium',
  },
  {
    id: 'ER-2024-005',
    category: 'Suspicious Activity',
    title: 'Unknown persons loitering near Angwan Rogo fence line',
    description:
      'Two unfamiliar individuals spotted taking photos of a perimeter fence along the estate boundary. Reported to community watch.',
    status: 'Resolved',
    reporter: 'Grace Adeyemi',
    location: 'Angwan Rogo Estate boundary',
    region: 'Angwan Rogo',
    severity: 'Low',
  },
  {
    id: 'ER-2024-006',
    category: 'Domestic Threat',
    title: 'Loud domestic disturbance reported',
    description: 'Neighbors reported shouting and signs of a physical altercation. Community leaders alerted for a welfare check.',
    status: 'Active',
    reporter: 'Anonymous',
    location: 'Tudun Wada residential area',
    region: 'Tudun Wada',
    severity: 'High',
  },
  {
    id: 'ER-2024-007',
    category: 'Fire Outbreak',
    title: 'Bush fire spreading near Bauchi Road junction',
    description:
      'Dry season bush fire spotted spreading towards residential structures along Bauchi Road. Fire service en route.',
    status: 'Active',
    reporter: 'Samuel Danladi',
    location: 'Bauchi Road junction',
    region: 'Bauchi Road',
    severity: 'Critical',
  },
];

// Mirrors data/alerts.json, minus `timeAgo` (same reasoning as above) and
// its `id` (Mongo generates its own, exposed as a string `id` via the
// Alert model's toJSON transform). NOTE: the frontend's own seed data
// tags one alert with region "Naraguta", which isn't in the REGIONS list
// used anywhere else in the app (constants/theme.ts) - treating that one
// as a global alert (region: null) here rather than seeding an invalid
// enum value.
const ALERTS_SEED = [
  {
    type: 'Emergency',
    title: 'Active emergency nearby',
    message: 'Armed robbery reported near Terminus Market, close to your area',
    unread: true,
    region: 'Terminus',
    relatedReportId: 'ER-2024-001',
  },
  {
    type: 'Update',
    title: 'Report status updated',
    message: 'Your report #ER-2024-001 has been assigned to Officer Johnson',
    unread: true,
    region: 'Terminus',
    relatedReportId: 'ER-2024-001',
  },
  {
    type: 'Announcement',
    title: 'Community safety meeting',
    message: 'Join us for a community safety discussion on Saturday at 4 PM',
    unread: false,
    region: 'Jos North',
  },
  {
    type: 'Update',
    title: 'Fire incident resolved',
    message: 'The fire outbreak along Bauchi Road has been successfully contained',
    unread: false,
    region: 'Bauchi Road',
    relatedReportId: 'ER-2024-002',
  },
  {
    type: 'Update',
    title: 'Report resolved',
    message: 'Your report #ER-2024-005 has been marked as resolved',
    unread: false,
    region: null, // see note above (was "Naraguta" in the frontend's seed)
    relatedReportId: 'ER-2024-005',
  },
  {
    type: 'Announcement',
    title: 'New security measures',
    message: 'Enhanced security protocols now active at all entry points across Jos',
    unread: false,
    region: 'Jos North',
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
    estate: 'Terminus',
    passwordHash: residentPasswordHash,
    role: 'resident',
  });

  const admin = await User.create({
    name: 'Officer Johnson',
    email: 'officer.johnson@example.com',
    phone: '+234 801 000 0000',
    estate: 'Terminus',
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

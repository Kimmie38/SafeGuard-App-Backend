/**
 * Must stay in sync with REGIONS in the frontend's constants/theme.ts.
 * SafeGuard is scoped to Jos, Plateau State for this build - every
 * resident/admin picks one of these areas, and reports/alerts are tagged
 * with one so the "mine" vs "all of Jos" scoping used throughout the
 * frontend (home, feed, alerts, manage, admin dashboard) has something
 * real to filter on.
 */
const REGIONS = [
  'Jos North',
  'Jos South',
  'Jos East',
  'Bukuru',
  'Rayfield',
  'Terminus',
  'Angwan Rogo',
  'Farin Gada',
  'Tudun Wada',
  'Bauchi Road',
];

module.exports = { REGIONS };

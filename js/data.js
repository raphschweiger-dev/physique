// Static training knowledge: muscles, priority tiers, movement slots, the exercise library and splits.

export const MUSCLES = [
  { id: 'chest_upper', name: 'Upper chest', group: 'Chest' },
  { id: 'chest', name: 'Mid chest', group: 'Chest' },
  { id: 'delts_front', name: 'Front delts', group: 'Shoulders' },
  { id: 'delts_side', name: 'Side delts', group: 'Shoulders' },
  { id: 'delts_rear', name: 'Rear delts', group: 'Shoulders' },
  { id: 'lats', name: 'Lats', group: 'Back' },
  { id: 'upper_back', name: 'Upper back & traps', group: 'Back' },
  { id: 'biceps', name: 'Biceps', group: 'Arms' },
  { id: 'triceps', name: 'Triceps', group: 'Arms' },
  { id: 'forearms', name: 'Forearms', group: 'Arms' },
  { id: 'abs', name: 'Abs', group: 'Core' },
  { id: 'quads', name: 'Quads', group: 'Legs' },
  { id: 'hamstrings', name: 'Hamstrings', group: 'Legs' },
  { id: 'glutes', name: 'Glutes', group: 'Legs' },
  { id: 'calves', name: 'Calves', group: 'Legs' },
];
export const MUSCLE = Object.fromEntries(MUSCLES.map(m => [m.id, m]));

// Weekly hard sets (fractional: indirect work counts 0.5) at the start and peak of a mesocycle.
// minDirect = share of the target that must come from direct work, so priority muscles
// still get their own exercises even when compounds already cover them on paper.
export const TIERS = {
  priority: { label: 'Priority', start: 12, peak: 20, minDirect: 0.6, rank: 0 },
  grow: { label: 'Grow', start: 8, peak: 14, minDirect: 0.4, rank: 1 },
  maintain: { label: 'Maintain', start: 6, peak: 10, minDirect: 0.3, rank: 2 },
  indirect: { label: 'Indirect only', start: 0, peak: 0, minDirect: 0, rank: 3 },
};
export const TIER_ORDER = ['priority', 'grow', 'maintain', 'indirect'];

export const BASELINE_PRIORITIES = {
  chest_upper: 'priority', delts_side: 'priority', lats: 'priority', biceps: 'priority', triceps: 'priority',
  chest: 'grow', upper_back: 'grow', delts_rear: 'grow', abs: 'grow', forearms: 'grow',
  quads: 'maintain', hamstrings: 'maintain', glutes: 'maintain', calves: 'maintain',
  delts_front: 'indirect',
};

export const EXPERIENCE = {
  beginner: { label: 'Under 1 year', mult: 0.8 },
  intermediate: { label: '1–3 years', mult: 1 },
  advanced: { label: '3+ years', mult: 1.1 },
};

// Movement slots. The plan is built from these, so a gym and a home session credit the same muscles.
export const SLOTS = {
  incline_press: { name: 'Incline press', muscle: 'chest_upper', compound: true, rest: 150, map: { chest_upper: 1, chest: 0.5, delts_front: 0.5, triceps: 0.5 } },
  chest_press: { name: 'Chest press', muscle: 'chest', compound: true, rest: 150, map: { chest: 1, chest_upper: 0.5, delts_front: 0.5, triceps: 0.5 } },
  chest_fly: { name: 'Chest fly', muscle: 'chest', compound: false, rest: 90, map: { chest: 1, chest_upper: 0.5 } },
  vertical_pull: { name: 'Vertical pull', muscle: 'lats', compound: true, rest: 150, map: { lats: 1, biceps: 0.5, upper_back: 0.5 } },
  lat_iso: { name: 'Lat isolation', muscle: 'lats', compound: false, rest: 90, map: { lats: 1 } },
  row: { name: 'Row', muscle: 'upper_back', compound: true, rest: 120, map: { upper_back: 1, lats: 0.5, delts_rear: 0.5, biceps: 0.5 } },
  overhead_press: { name: 'Overhead press', muscle: 'delts_front', compound: true, rest: 150, map: { delts_front: 1, delts_side: 0.5, triceps: 0.5 } },
  lateral_raise: { name: 'Lateral raise', muscle: 'delts_side', compound: false, rest: 75, map: { delts_side: 1 } },
  rear_delt: { name: 'Rear-delt fly', muscle: 'delts_rear', compound: false, rest: 75, map: { delts_rear: 1, upper_back: 0.5 } },
  curl: { name: 'Curl', muscle: 'biceps', compound: false, rest: 90, map: { biceps: 1, forearms: 0.5 } },
  triceps_oh: { name: 'Overhead triceps', muscle: 'triceps', compound: false, rest: 90, map: { triceps: 1 } },
  triceps_ext: { name: 'Triceps extension', muscle: 'triceps', compound: false, rest: 90, map: { triceps: 1 } },
  forearm: { name: 'Forearms', muscle: 'forearms', compound: false, rest: 60, map: { forearms: 1 } },
  abs: { name: 'Abs', muscle: 'abs', compound: false, rest: 60, map: { abs: 1 } },
  squat: { name: 'Squat pattern', muscle: 'quads', compound: true, rest: 180, map: { quads: 1, glutes: 0.5 } },
  quad_iso: { name: 'Quad isolation', muscle: 'quads', compound: false, rest: 90, map: { quads: 1 } },
  hinge: { name: 'Hip hinge', muscle: 'hamstrings', compound: true, rest: 150, map: { hamstrings: 1, glutes: 0.5 } },
  leg_curl: { name: 'Leg curl', muscle: 'hamstrings', compound: false, rest: 90, map: { hamstrings: 1 } },
  glute: { name: 'Glutes', muscle: 'glutes', compound: true, rest: 120, map: { glutes: 1 } },
  calf: { name: 'Calf raise', muscle: 'calves', compound: false, rest: 75, map: { calves: 1 } },
};

// Movements per muscle: the first is the main one, the second is added when a session has 5+ sets.
export const MUSCLE_SLOTS = {
  chest_upper: ['incline_press'],
  chest: ['chest_press', 'chest_fly'],
  delts_front: ['overhead_press'],
  delts_side: ['lateral_raise'],
  delts_rear: ['rear_delt'],
  lats: ['vertical_pull', 'lat_iso'],
  upper_back: ['row'],
  biceps: ['curl'],
  triceps: ['triceps_oh', 'triceps_ext'],
  forearms: ['forearm'],
  abs: ['abs'],
  quads: ['squat', 'quad_iso'],
  hamstrings: ['hinge', 'leg_curl'],
  glutes: ['glute'],
  calves: ['calf'],
};
// Muscles whose single-movement sessions alternate (e.g. RDL one day, leg curl the next).
export const ALTERNATE = new Set(['chest', 'hamstrings']);

// Equipment: gym = barbell | dumbbell | cable | machine | smith | bodyweight (weight = added load).
// Home = dumbbell | kettlebell | free (either) | bodyweight (weight = added load).
const G = (id, name, slot, equip, reps, cue, extra = {}) => ({ id, name, slot, loc: 'gym', equip, reps, cue, ...extra });
const H = (id, name, slot, equip, reps, cue, extra = {}) => ({ id, name, slot, loc: 'home', equip, reps, cue, ...extra });

export const EXERCISES = [
  // Upper chest
  G('incline_db_press', 'Incline DB press', 'incline_press', 'dumbbell', [8, 12], 'Bench at ~30°. Lower until you feel a deep chest stretch, elbows ~45° from your sides.'),
  G('incline_machine_press', 'Incline machine press', 'incline_press', 'machine', [8, 12], 'Seat set so the handles start at upper-chest height. Full stretch at the bottom.'),
  G('incline_smith_press', 'Incline Smith press', 'incline_press', 'smith', [6, 10], 'Bench at ~30°, bar to the upper chest, 2–3 s lowering.'),
  G('low_high_fly', 'Low-to-high cable fly', 'incline_press', 'cable', [10, 15], 'Pulleys low, sweep up to chin height. Big stretch at the bottom.', { map: { chest_upper: 1, chest: 0.5 } }),
  H('h_fe_pushup', 'Feet-elevated push-up', 'incline_press', 'bodyweight', [8, 20], 'Feet on a chair or couch, hands a bit wider than shoulders, chest all the way down.', { bw: 0.7, needs: ['chair'], next: 'h_fe_deficit_pushup' }),
  H('h_fe_deficit_pushup', 'Feet-elevated deficit push-up', 'incline_press', 'bodyweight', [8, 20], 'Feet up, hands on dumbbells or kettlebells so your chest sinks below your hands. Past 20 reps wear a backpack with a weight.', { bw: 0.72, needs: ['chair'] }),
  H('h_incline_db_press', 'Incline DB press', 'incline_press', 'dumbbell', [10, 25], 'Bench at ~30°, deep stretch at the bottom.', { needs: ['bench'] }),

  // Mid chest
  G('machine_chest_press', 'Machine chest press', 'chest_press', 'machine', [8, 12], 'Deep stretch at the bottom without letting the shoulders roll forward.'),
  G('flat_db_press', 'Flat DB press', 'chest_press', 'dumbbell', [8, 12], 'Lower to a deep stretch, brief pause, press up and slightly in.'),
  G('chest_dip', 'Chest dip', 'chest_press', 'bodyweight', [6, 12], 'Lean forward and sink deep. Add weight once you pass 12 reps.', { bw: 0.95, map: { chest: 1, triceps: 0.5, delts_front: 0.5 } }),
  G('bench_press', 'Barbell bench press', 'chest_press', 'barbell', [6, 10], 'Shoulder blades pinned, bar to mid-chest, controlled lowering.'),
  G('cable_fly', 'Cable fly', 'chest_fly', 'cable', [10, 15], 'Soft elbows, let the handles travel behind you for a big stretch.'),
  G('pec_deck', 'Pec deck', 'chest_fly', 'machine', [10, 15], 'Set the arms so you get a full stretch. Squeeze briefly at the front.'),
  G('db_fly', 'DB fly', 'chest_fly', 'dumbbell', [10, 15], 'Wide arc, deep stretch, stop before the bells touch.'),
  H('h_pushup', 'Push-up', 'chest_press', 'bodyweight', [8, 20], 'Body in one line, chest to the floor, 2 s down.', { bw: 0.64, next: 'h_deficit_pushup' }),
  H('h_deficit_pushup', 'Deficit push-up', 'chest_press', 'bodyweight', [8, 20], 'Hands on dumbbells or kettlebells, sink deep for a big stretch, 2 s down.', { bw: 0.66, next: 'h_archer_pushup' }),
  H('h_archer_pushup', 'Archer push-up', 'chest_press', 'bodyweight', [5, 12], 'Shift your weight onto one arm, the other stays long. Reps per side.', { bw: 0.8 }),
  H('h_db_bench_press', 'DB bench press', 'chest_press', 'dumbbell', [10, 25], 'Deep stretch at the bottom, press up and slightly in.', { needs: ['bench'] }),
  H('h_db_floor_press', 'DB floor press', 'chest_press', 'dumbbell', [12, 25], 'Lie on the floor, pause with the elbows on the ground.'),
  H('h_db_fly', 'DB fly', 'chest_fly', 'dumbbell', [12, 25], 'On a bench, wide arc into a deep stretch.', { needs: ['bench'] }),
  H('h_wide_deficit_pushup', 'Wide deficit push-up (slow)', 'chest_fly', 'bodyweight', [8, 20], 'Hands wide on dumbbells, 3-second lowering into a deep stretch.', { bw: 0.64, map: { chest: 1, chest_upper: 0.5, triceps: 0.5 } }),
  H('h_floor_fly', 'DB floor fly', 'chest_fly', 'dumbbell', [15, 30], 'Lie on the floor, slow arc until the elbows touch down.'),

  // Lats
  G('lat_pulldown', 'Lat pulldown', 'vertical_pull', 'cable', [8, 12], 'Full stretch at the top, drive the elbows down to your sides.'),
  G('pullup', 'Pull-up', 'vertical_pull', 'bodyweight', [6, 12], 'Dead hang at the bottom, chest to the bar. Add weight past 12 reps.', { bw: 1 }),
  G('neutral_pulldown', 'Neutral-grip pulldown', 'vertical_pull', 'cable', [8, 12], 'Close neutral handle, lean back slightly, elbows to the hips.'),
  G('single_arm_pulldown', 'Single-arm cable pulldown', 'vertical_pull', 'cable', [10, 15], 'Let the lat stretch fully overhead, pull the elbow to your hip.'),
  G('straight_arm_pulldown', 'Straight-arm pulldown', 'lat_iso', 'cable', [10, 15], 'Hinge slightly, arms long, sweep the bar to your thighs.'),
  G('db_pullover', 'DB pullover', 'lat_iso', 'dumbbell', [10, 15], 'Across a bench, lower the bell behind your head into a deep stretch.'),
  G('machine_pullover', 'Machine pullover', 'lat_iso', 'machine', [10, 15], 'Start fully stretched overhead, drive the elbows down.'),
  H('h_pullup', 'Pull-up', 'vertical_pull', 'bodyweight', [5, 12], 'Dead hang, chest up to the bar, 2-s lowering. Past 12 reps hold a weight between your feet.', { bw: 1, needs: ['bar'] }),
  H('h_chinup', 'Chin-up', 'vertical_pull', 'bodyweight', [5, 12], 'Palms facing you, full hang at the bottom. Hits the biceps hard too.', { bw: 1, needs: ['bar'] }),
  H('h_negative_pullup', 'Pull-up negatives', 'vertical_pull', 'bodyweight', [3, 8], 'Jump to the top, lower yourself over 4–5 s. Use until you can do 5 strict pull-ups.', { bw: 1, needs: ['bar'], next: 'h_pullup' }),
  H('h_lat_kb_row', 'Lat-focus row', 'lat_iso', 'free', [10, 20], 'Hand on a chair, let the weight stretch forward, pull the elbow back to your hip.', { map: { lats: 1, upper_back: 0.5 } }),
  H('h_kb_pullover', 'Floor pullover', 'lat_iso', 'free', [10, 20], 'Lying down, lower the weight behind your head with long arms.'),

  // Upper back
  G('chest_supported_row', 'Chest-supported row', 'row', 'machine', [8, 12], 'Let the shoulder blades spread at the bottom, row to the lower ribs.'),
  G('seated_cable_row', 'Seated cable row', 'row', 'cable', [8, 12], 'Lean forward slightly for the stretch, then row tall.'),
  G('one_arm_db_row', 'One-arm DB row', 'row', 'dumbbell', [8, 12], 'Let the shoulder sink at the bottom, row the elbow to your hip.'),
  G('tbar_row', 'T-bar row', 'row', 'machine', [8, 12], 'Chest on the pad if possible, full stretch, squeeze the shoulder blades.'),
  H('h_kb_row', 'One-arm KB row', 'row', 'kettlebell', [10, 20], 'Hand on a chair, let the shoulder stretch down, row to your hip.'),
  H('h_db_row', 'One-arm DB row', 'row', 'dumbbell', [12, 25], 'Hand on a chair, slow lowering, squeeze at the top.'),
  H('h_bent_db_row', 'Bent-over DB row', 'row', 'dumbbell', [12, 25], 'Hinge to ~45°, row both dumbbells to the lower ribs.'),

  // Front delts (only programmed if you raise front delts above "Indirect only")
  G('machine_shoulder_press', 'Machine shoulder press', 'overhead_press', 'machine', [8, 12], 'Handles start at ear height, press without shrugging.'),
  G('seated_db_press', 'Seated DB shoulder press', 'overhead_press', 'dumbbell', [8, 12], 'Lower to ear level, press up and slightly in.'),
  H('h_kb_press', 'KB overhead press', 'overhead_press', 'kettlebell', [8, 15], 'Bell on the back of the forearm, press up without leaning back.'),
  H('h_pike_pushup', 'Pike push-up', 'overhead_press', 'bodyweight', [6, 15], 'Hips high, head travels in front of the hands.', { bw: 0.5 }),

  // Side delts
  G('cable_lateral', 'Cable lateral raise', 'lateral_raise', 'cable', [12, 20], 'Cable behind you, start from across the body (stretch), raise to shoulder height.'),
  G('db_lateral', 'DB lateral raise', 'lateral_raise', 'dumbbell', [12, 20], 'Slight forward lean, lead with the elbows, stop at shoulder height.'),
  G('machine_lateral', 'Machine lateral raise', 'lateral_raise', 'machine', [12, 20], 'Pads on the outside of the elbows, smooth up, slow down.'),
  H('h_db_lateral', 'DB lateral raise', 'lateral_raise', 'dumbbell', [12, 25], 'Slight forward lean, lead with the elbows, stop at shoulder height.'),
  H('h_lean_lateral', 'Lean-away lateral raise', 'lateral_raise', 'dumbbell', [12, 25], 'Hold a door frame and lean away; tension starts at the bottom (stretch). Reps per side.'),
  H('h_side_lying_lateral', 'Side-lying lateral raise', 'lateral_raise', 'dumbbell', [12, 25], 'Lie on your side on the floor or couch, raise to vertical. Hardest at the bottom.'),

  // Rear delts
  G('reverse_pec_deck', 'Reverse pec deck', 'rear_delt', 'machine', [12, 20], 'Arms nearly straight, sweep wide, don’t shrug.'),
  G('cable_rear_fly', 'Cable rear-delt fly', 'rear_delt', 'cable', [12, 20], 'Cross the cables, pull out and back in a wide arc.'),
  G('face_pull', 'Face pull', 'rear_delt', 'cable', [12, 20], 'Rope at face height, pull to the ears with the elbows high.'),
  H('h_db_rear_fly', 'Bent-over DB reverse fly', 'rear_delt', 'dumbbell', [12, 25], 'Chest toward the thighs, sweep the arms wide, pinkies up.'),
  H('h_kb_rear_row', 'Wide rear-delt row', 'rear_delt', 'free', [12, 20], 'Bent over, elbow flared out to 90°, pull toward the ceiling.'),

  // Biceps
  G('incline_db_curl', 'Incline DB curl', 'curl', 'dumbbell', [8, 15], 'Arms hang behind your body for a full biceps stretch. No swinging.'),
  G('bayesian_curl', 'Bayesian cable curl', 'curl', 'cable', [10, 15], 'Face away from the cable, arm behind the body, keep the elbow still.'),
  G('preacher_curl', 'Preacher curl', 'curl', 'machine', [8, 12], 'Full stretch at the bottom, slow lowering.'),
  G('hammer_curl', 'Hammer curl', 'curl', 'dumbbell', [8, 15], 'Neutral grip, elbows still. Hits brachialis and forearms too.', { map: { biceps: 1, forearms: 1 } }),
  H('h_incline_curl', 'Incline DB curl', 'curl', 'dumbbell', [10, 20], 'Bench at 45–60°, arms hang behind you for a full stretch.', { needs: ['bench'] }),
  H('h_db_curl', 'DB curl', 'curl', 'dumbbell', [10, 20], 'Full lockout at the bottom, turn the pinky up, 2-s lowering.'),
  H('h_hammer_curl', 'Hammer curl', 'curl', 'dumbbell', [10, 20], 'Neutral grip, elbows still.', { map: { biceps: 1, forearms: 1 } }),
  H('h_kb_curl', 'KB curl', 'curl', 'kettlebell', [8, 15], 'Hold the handle with the bell hanging, curl without swinging.'),

  // Triceps
  G('oh_cable_ext', 'Overhead cable extension', 'triceps_oh', 'cable', [10, 15], 'Face away from the cable, elbows by your head, deep stretch (long head).'),
  G('oh_db_ext', 'Overhead DB extension', 'triceps_oh', 'dumbbell', [10, 15], 'Both hands on one dumbbell, elbows up, lower deep behind your head.'),
  G('rope_pushdown', 'Rope pushdown', 'triceps_ext', 'cable', [10, 15], 'Elbows pinned, spread the rope at the bottom.'),
  G('skull_crusher', 'EZ-bar skull crusher', 'triceps_ext', 'barbell', [8, 12], 'Lower behind the head for extra stretch.'),
  G('triceps_dip', 'Triceps dip', 'triceps_ext', 'bodyweight', [6, 12], 'Torso upright, elbows back. Add weight past 12 reps.', { bw: 0.95, map: { triceps: 1, chest: 0.5, delts_front: 0.5 } }),
  H('h_oh_db_ext', 'Overhead DB extension', 'triceps_oh', 'dumbbell', [12, 25], 'Both hands on one dumbbell, elbows up, lower deep behind your head.'),
  H('h_oh_kb_ext', 'Overhead KB extension', 'triceps_oh', 'kettlebell', [10, 20], 'Hold the bell by the horns, lower behind your head.'),
  H('h_floor_skull', 'Floor skull crusher', 'triceps_ext', 'dumbbell', [12, 25], 'Lie on the floor, lower the dumbbells behind your head.'),
  H('h_close_pushup', 'Close-grip push-up', 'triceps_ext', 'bodyweight', [8, 20], 'Hands under the shoulders, elbows brush your ribs.', { bw: 0.64, map: { triceps: 1, chest: 0.5 } }),
  H('h_chair_dip', 'Chair dip', 'triceps_ext', 'bodyweight', [10, 25], 'Hands on a sturdy chair behind you, elbows straight back.', { bw: 0.5, needs: ['chair'] }),

  // Forearms
  G('db_wrist_curl', 'Wrist curl', 'forearm', 'dumbbell', [12, 20], 'Forearms on a bench, let the weight roll to the fingertips.'),
  G('reverse_curl', 'Reverse EZ curl', 'forearm', 'barbell', [10, 15], 'Overhand grip, elbows still.', { map: { forearms: 1, biceps: 0.5 } }),
  H('h_wrist_curl', 'DB wrist curl', 'forearm', 'dumbbell', [15, 30], 'Forearms on your thighs, let the weight roll to the fingertips.'),
  H('h_reverse_curl', 'Reverse DB curl', 'forearm', 'dumbbell', [12, 25], 'Overhand grip, elbows still.', { map: { forearms: 1, biceps: 0.5 } }),

  // Abs
  G('cable_crunch', 'Cable crunch', 'abs', 'cable', [10, 15], 'Round the spine, ribs to hips. Don’t sit back into it.'),
  G('hanging_leg_raise', 'Hanging leg raise', 'abs', 'bodyweight', [8, 15], 'Curl the pelvis up, no swinging.'),
  G('machine_crunch', 'Machine crunch', 'abs', 'machine', [10, 15], 'Exhale and curl down, slow return.'),
  H('h_hanging_knee_raise', 'Hanging knee raise', 'abs', 'bodyweight', [10, 20], 'Curl the pelvis up, don’t just lift the knees. No swinging.', { needs: ['bar'], next: 'h_hanging_leg_raise' }),
  H('h_hanging_leg_raise', 'Hanging leg raise', 'abs', 'bodyweight', [8, 15], 'Straight legs, curl the pelvis up, no swinging.', { needs: ['bar'] }),
  H('h_weighted_crunch', 'Weighted crunch', 'abs', 'free', [12, 25], 'Weight on your chest, round the spine, ribs to hips.'),

  // Quads
  G('hack_squat', 'Hack squat', 'squat', 'machine', [8, 12], 'As deep as you can, let the knees travel forward.'),
  G('leg_press', 'Leg press', 'squat', 'machine', [10, 15], 'Feet low-to-mid, deep without the hips rolling up.'),
  G('smith_squat', 'Smith squat', 'squat', 'smith', [8, 12], 'Feet slightly forward, sit straight down deep.'),
  G('back_squat', 'Back squat', 'squat', 'barbell', [6, 10], 'Brace, sit deep, drive up.'),
  G('leg_extension', 'Leg extension', 'quad_iso', 'machine', [10, 15], 'Recline the seat if you can (stretches the rectus femoris), pause at the top.'),
  H('h_bss', 'Bulgarian split squat', 'squat', 'free', [8, 15], 'Rear foot on a chair, sink deep, slight forward lean. Reps per leg.', { bw: 0.75, needs: ['chair'] }),
  H('h_goblet_squat', 'Heels-elevated goblet squat', 'squat', 'free', [10, 20], 'Heels on a book or plate, sit deep and upright.', { bw: 0.6 }),
  H('h_sissy_squat', 'Sissy squat', 'quad_iso', 'bodyweight', [8, 20], 'Hold a door frame, knees forward, lean back. Big quad stretch.', { bw: 0.6 }),

  // Hamstrings
  G('rdl', 'Romanian deadlift', 'hinge', 'barbell', [8, 12], 'Hips back until a deep hamstring stretch, flat back, bar close.'),
  G('db_rdl', 'DB Romanian deadlift', 'hinge', 'dumbbell', [8, 12], 'Hips back, dumbbells slide down the thighs, deep stretch.'),
  G('seated_leg_curl', 'Seated leg curl', 'leg_curl', 'machine', [10, 15], 'Lean forward for more stretch. Seated grows hamstrings more than lying (Maeo 2021).'),
  G('lying_leg_curl', 'Lying leg curl', 'leg_curl', 'machine', [10, 15], 'Hips down, slow lowering.'),
  H('h_kb_rdl', 'Romanian deadlift', 'hinge', 'free', [10, 20], 'Hips back until a deep hamstring stretch, weight close to the legs.'),
  H('h_sl_rdl', 'Single-leg RDL', 'hinge', 'free', [8, 15], 'Hold a wall lightly for balance, deep hip hinge. Reps per leg.'),
  H('h_slider_curl', 'Slider leg curl', 'leg_curl', 'bodyweight', [8, 20], 'Heels on a towel on a smooth floor, hips up, pull the heels in.', { next: 'h_nordic' }),
  H('h_nordic', 'Nordic curl', 'leg_curl', 'bodyweight', [3, 8], 'Feet anchored under a couch, lower as slowly as you can, push back up with your hands.'),

  // Glutes
  G('hip_thrust', 'Hip thrust', 'glute', 'barbell', [8, 12], 'Chin tucked, shins vertical at the top, squeeze for 1 s.'),
  G('machine_hip_thrust', 'Machine hip thrust', 'glute', 'machine', [8, 12], 'Full lockout, pause at the top.'),
  H('h_kb_hip_thrust', 'Hip thrust', 'glute', 'free', [10, 20], 'Upper back on the couch, weight on the hips, squeeze 1 s at the top.'),
  H('h_sl_hip_thrust', 'Single-leg hip thrust', 'glute', 'bodyweight', [8, 20], 'Upper back on the couch, one leg up, full lockout. Reps per leg.'),

  // Calves
  G('standing_calf', 'Standing calf raise', 'calf', 'machine', [10, 15], 'Pause 2 s in the deep stretch at the bottom. Full range.'),
  G('leg_press_calf', 'Leg-press calf raise', 'calf', 'machine', [10, 15], 'Balls of the feet on the edge, deep stretch, pause.'),
  H('h_sl_calf', 'Single-leg calf raise', 'calf', 'bodyweight', [10, 20], 'On a stair edge, hold a weight, pause 2 s at the bottom stretch. Reps per leg.'),
];
export const EXERCISE = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

const UPPER = ['chest_upper', 'chest', 'delts_front', 'delts_side', 'delts_rear', 'lats', 'upper_back', 'biceps', 'triceps', 'forearms'];
const LEGS = ['quads', 'hamstrings', 'glutes', 'calves'];
const PUSH = ['chest_upper', 'chest', 'delts_front', 'delts_side', 'triceps'];
const PULL = ['lats', 'upper_back', 'delts_rear', 'biceps', 'forearms'];

// Which muscles get direct work on which day. Volume per day is decided by the engine.
export const SPLITS = {
  2: [
    { name: 'Full Body A', muscles: [...UPPER, ...LEGS, 'abs'] },
    { name: 'Full Body B', muscles: [...UPPER, ...LEGS, 'abs'] },
  ],
  3: [
    { name: 'Full Body A', muscles: [...UPPER, 'quads', 'hamstrings', 'glutes'] },
    { name: 'Full Body B', muscles: [...UPPER, 'calves', 'abs'] },
    { name: 'Full Body C', muscles: [...UPPER, ...LEGS, 'abs'] },
  ],
  4: [
    { name: 'Upper A', muscles: UPPER },
    { name: 'Legs + Arms', muscles: [...LEGS, 'biceps', 'triceps', 'forearms', 'abs'] },
    { name: 'Upper B', muscles: UPPER },
    { name: 'Legs + Delts', muscles: [...LEGS, 'delts_side', 'delts_rear', 'abs'] },
  ],
  5: [
    { name: 'Upper A', muscles: UPPER },
    { name: 'Legs A', muscles: [...LEGS, 'abs'] },
    { name: 'Upper B', muscles: UPPER },
    { name: 'Legs B', muscles: [...LEGS, 'abs'] },
    { name: 'Upper C: Delts & Arms', muscles: ['chest_upper', 'lats', 'delts_side', 'delts_rear', 'biceps', 'triceps', 'forearms'] },
  ],
  6: [
    { name: 'Push A', muscles: PUSH },
    { name: 'Pull A', muscles: PULL },
    { name: 'Legs + Delts A', muscles: [...LEGS, 'delts_side', 'delts_rear', 'abs'] },
    { name: 'Push B', muscles: PUSH },
    { name: 'Pull B', muscles: PULL },
    { name: 'Legs + Delts B', muscles: [...LEGS, 'delts_side', 'delts_rear', 'abs'] },
  ],
};

// Harder ways to do the same weight once you outgrow your heaviest dumbbell or kettlebell.
export const TECHNIQUE_LEVELS = [
  { name: 'Standard', cue: '' },
  { name: '3-s lowering', cue: 'Take 3 full seconds on every lowering.' },
  { name: 'Pause in the stretch', cue: '3-s lowering, then hold 2 s in the stretched position.' },
  { name: '1½ reps', cue: 'Go down, come halfway up, go back down, then all the way up. That is one rep.' },
];

export const SCIENCE = [
  { title: 'Volume', text: '10–20+ hard sets per muscle per week. Sets where a muscle only helps count as ½.', refs: 'Schoenfeld 2017 · Pelland 2024' },
  { title: 'Frequency', text: 'Every muscle at least twice a week, no more than ~8 hard sets for one muscle in a session.', refs: 'Schoenfeld 2016' },
  { title: 'Effort', text: 'Stop 0–3 reps before failure. Big lifts 1–2 reps in reserve, single-muscle exercises 0–1.', refs: 'Robinson 2024' },
  { title: 'Reps', text: 'Big lifts 6–12, single-muscle exercises 10–20. At home 15–30 works if you go close to failure.', refs: 'Schoenfeld 2017 · Lasevicius 2018' },
  { title: 'Exercise choice', text: 'Exercises that load the muscle while it is stretched build more muscle.', refs: 'Maeo 2021/2023 · Pedrosa 2022' },
  { title: 'Rest', text: '2–3 min for big lifts, ~1.5 min for single-muscle exercises.', refs: 'Schoenfeld 2016 · Singer 2024' },
  { title: 'Progression', text: 'Add reps first, then weight. Adding reps builds muscle as well as adding weight.', refs: 'Plotkin 2022' },
  { title: 'Deloads', text: 'An easy week every ~5–6 weeks, or earlier when performance drops.', refs: 'Expert consensus (Bell 2023)' },
];
